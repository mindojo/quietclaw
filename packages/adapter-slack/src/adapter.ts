import type { AdapterCapabilities, AdapterHealth, ChannelAdapter, IngestEmitter } from "@quietclaw/adapter-sdk";

import { SlackApiClient } from "./client.js";
import { mapSlackEventToEnvelope } from "./mapper.js";
import type { SlackConversation, SlackSocketEnvelope } from "./types.js";

const ADAPTER_VERSION = "1.0.0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class SlackAdapter implements ChannelAdapter {
  readonly id = "slack";
  readonly displayName = "Slack";

  private readonly client: SlackApiClient;
  private readonly conversations = new Map<string, SlackConversation>();
  private health: AdapterHealth = {
    ok: false,
    state: "idle",
    detail: null,
    lastEventAt: null,
  };
  private running = false;
  private socket: WebSocket | null = null;

  constructor(token: string, appToken: string) {
    this.client = new SlackApiClient(token, appToken);
  }

  getCapabilities(): AdapterCapabilities {
    return {
      officiality: "official",
      supportsLiveStream: true,
      supportsHistoryFetch: true,
      supportsMembershipSnapshots: false,
      supportsThreads: true,
      supportsEdits: true,
      requiresPublicEndpoint: false,
      selfHostableForTests: false,
    };
  }

  getHealth(): AdapterHealth {
    return { ...this.health };
  }

  async connect(emit: IngestEmitter): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.health = {
      ok: false,
      state: "connecting",
      detail: "Authenticating with Slack.",
      lastEventAt: this.health.lastEventAt,
    };

    try {
      await this.client.authTest();
      await this.refreshConversations();
    } catch (error) {
      this.running = false;
      this.health = {
        ok: false,
        state: "error",
        detail: error instanceof Error ? error.message : "Slack authentication failed.",
        lastEventAt: this.health.lastEventAt,
      };
      throw error;
    }

    this.health = {
      ok: true,
      state: "ready",
      detail: "Listening to Slack Socket Mode events.",
      lastEventAt: this.health.lastEventAt,
    };

    while (this.running) {
      try {
        const socketUrl = await this.client.openSocketModeConnection();
        await this.runSocketLoop(socketUrl, emit);
      } catch (error) {
        if (!this.running) {
          break;
        }

        this.health = {
          ok: false,
          state: "degraded",
          detail: error instanceof Error ? error.message : "Slack Socket Mode connection failed.",
          lastEventAt: this.health.lastEventAt,
        };
        await sleep(5_000);
      }
    }

    this.health = {
      ok: false,
      state: "idle",
      detail: "Slack adapter disconnected.",
      lastEventAt: this.health.lastEventAt,
    };
  }

  async disconnect(): Promise<void> {
    this.running = false;
    this.socket?.close();
    this.socket = null;
  }

  async listConversations(): Promise<Array<{ id: string; name: string }>> {
    await this.refreshConversations();

    return [...this.conversations.values()].map((conversation) => ({
      id: `slack:${conversation.id}`,
      name: conversation.name ?? conversation.id,
    }));
  }

  async runBackfill(emit: IngestEmitter, options?: { limit?: number }): Promise<void> {
    await this.refreshConversations();

    for (const conversation of this.conversations.values()) {
      const history = await this.client.getConversationHistory(conversation.id, options?.limit ?? 100);

      for (const event of history) {
        const envelope = mapSlackEventToEnvelope(event, ADAPTER_VERSION, { channel: conversation });
        if (envelope !== null) {
          await emit({
            ...envelope,
            delivery: {
              ...envelope.delivery,
              isBackfill: true,
            },
          });
        }
      }
    }
  }

  private async refreshConversations(): Promise<void> {
    const conversations = await this.client.listConversations();
    for (const conversation of conversations) {
      this.conversations.set(conversation.id, conversation);
    }
  }

  private async runSocketLoop(socketUrl: string, emit: IngestEmitter): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(socketUrl);
      this.socket = socket;

      socket.addEventListener("open", () => {
        this.health = {
          ok: true,
          state: "ready",
          detail: "Listening to Slack Socket Mode events.",
          lastEventAt: this.health.lastEventAt,
        };
      });

      socket.addEventListener("message", async (rawMessage) => {
        try {
          const payload = JSON.parse(String(rawMessage.data)) as SlackSocketEnvelope;

          if (payload.envelope_id) {
            socket.send(JSON.stringify({ envelope_id: payload.envelope_id }));
          }

          const event = payload.payload?.event;
          if (!event || event.type !== "message") {
            return;
          }

          const channel = this.conversations.get(event.channel);
          const envelope = channel
            ? mapSlackEventToEnvelope(event, ADAPTER_VERSION, { channel })
            : mapSlackEventToEnvelope(event, ADAPTER_VERSION);
          if (envelope === null) {
            return;
          }

          await emit(envelope);
          this.health = {
            ok: true,
            state: "ready",
            detail: "Listening to Slack Socket Mode events.",
            lastEventAt: envelope.delivery.observedAt,
          };
        } catch (error) {
          this.health = {
            ok: false,
            state: "degraded",
            detail: error instanceof Error ? error.message : "Slack event parsing failed.",
            lastEventAt: this.health.lastEventAt,
          };
        }
      });

      socket.addEventListener("close", () => {
        this.socket = null;
        resolve();
      });

      socket.addEventListener("error", () => {
        reject(new Error("Slack Socket Mode transport error."));
      });
    });
  }
}
