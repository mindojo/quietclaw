import type { AdapterCapabilities, AdapterHealth, ChannelAdapter, IngestEmitter } from "@quietclaw/adapter-sdk";

import { MattermostApiClient } from "./client.js";
import { mapMattermostEventToEnvelope } from "./mapper.js";
import type { MattermostChannel, MattermostSocketEvent } from "./types.js";

const ADAPTER_VERSION = "1.0.0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class MattermostAdapter implements ChannelAdapter {
  readonly id = "mattermost";
  readonly displayName = "Mattermost";

  private readonly client: MattermostApiClient;
  private readonly channels = new Map<string, MattermostChannel>();
  private health: AdapterHealth = {
    ok: false,
    state: "idle",
    detail: null,
    lastEventAt: null,
  };
  private running = false;
  private socket: WebSocket | null = null;

  constructor(serverUrl: string, token: string) {
    this.client = new MattermostApiClient(serverUrl, token);
    this.serverUrl = serverUrl;
  }

  private readonly serverUrl: string;

  getCapabilities(): AdapterCapabilities {
    return {
      officiality: "open_protocol",
      supportsLiveStream: true,
      supportsHistoryFetch: true,
      supportsMembershipSnapshots: true,
      supportsThreads: true,
      supportsEdits: true,
      requiresPublicEndpoint: false,
      selfHostableForTests: true,
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
      detail: "Authenticating with Mattermost.",
      lastEventAt: this.health.lastEventAt,
    };

    try {
      await this.client.getMe();
      await this.refreshChannels();
    } catch (error) {
      this.running = false;
      this.health = {
        ok: false,
        state: "error",
        detail: error instanceof Error ? error.message : "Mattermost authentication failed.",
        lastEventAt: this.health.lastEventAt,
      };
      throw error;
    }

    while (this.running) {
      try {
        await this.runSocketLoop(emit);
      } catch (error) {
        if (!this.running) {
          break;
        }

        this.health = {
          ok: false,
          state: "degraded",
          detail: error instanceof Error ? error.message : "Mattermost websocket failed.",
          lastEventAt: this.health.lastEventAt,
        };
        await sleep(5_000);
      }
    }

    this.health = {
      ok: false,
      state: "idle",
      detail: "Mattermost adapter disconnected.",
      lastEventAt: this.health.lastEventAt,
    };
  }

  async disconnect(): Promise<void> {
    this.running = false;
    this.socket?.close();
    this.socket = null;
  }

  async listConversations(): Promise<Array<{ id: string; name: string }>> {
    await this.refreshChannels();
    return [...this.channels.values()].map((channel) => ({
      id: `mattermost:${channel.id}`,
      name: channel.display_name ?? channel.name ?? channel.id,
    }));
  }

  async runBackfill(emit: IngestEmitter, options?: { limit?: number }): Promise<void> {
    await this.refreshChannels();

    for (const channel of this.channels.values()) {
      const posts = await this.client.listPosts(channel.id, options?.limit ?? 100);

      for (const post of posts) {
        const envelope = mapMattermostEventToEnvelope(
          { event: "posted", broadcast: { channel_id: channel.id } },
          ADAPTER_VERSION,
          { channel, post },
        );

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

  private async refreshChannels(): Promise<void> {
    const channels = await this.client.listChannels();
    for (const channel of channels) {
      this.channels.set(channel.id, channel);
    }
  }

  private async runSocketLoop(emit: IngestEmitter): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socketUrl = new URL("/api/v4/websocket", this.serverUrl);
      const socket = new WebSocket(socketUrl);
      this.socket = socket;

      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({
          seq: 1,
          action: "authentication_challenge",
          data: { token: this.client.getAccessToken() },
        }));
        this.health = {
          ok: true,
          state: "ready",
          detail: "Listening to Mattermost websocket events.",
          lastEventAt: this.health.lastEventAt,
        };
      });

      socket.addEventListener("message", async (rawMessage) => {
        try {
          const event = JSON.parse(String(rawMessage.data)) as MattermostSocketEvent;
          if (!["posted", "post_edited", "post_deleted"].includes(event.event)) {
            return;
          }

          const channelId = event.broadcast?.channel_id;
          const channel = channelId ? this.channels.get(channelId) : undefined;
          const envelope = channel
            ? mapMattermostEventToEnvelope(event, ADAPTER_VERSION, { channel })
            : mapMattermostEventToEnvelope(event, ADAPTER_VERSION);

          if (envelope === null) {
            return;
          }

          await emit(envelope);
          this.health = {
            ok: true,
            state: "ready",
            detail: "Listening to Mattermost websocket events.",
            lastEventAt: envelope.delivery.observedAt,
          };
        } catch (error) {
          this.health = {
            ok: false,
            state: "degraded",
            detail: error instanceof Error ? error.message : "Mattermost event parsing failed.",
            lastEventAt: this.health.lastEventAt,
          };
        }
      });

      socket.addEventListener("close", () => {
        this.socket = null;
        resolve();
      });

      socket.addEventListener("error", () => {
        reject(new Error("Mattermost websocket transport error."));
      });
    });
  }

}
