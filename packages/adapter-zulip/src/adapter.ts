import type { AdapterCapabilities, AdapterHealth, ChannelAdapter, IngestEmitter } from "@quietclaw/adapter-sdk";

import { ZulipApiClient } from "./client.js";
import { mapZulipEventToEnvelope } from "./mapper.js";

const ADAPTER_VERSION = "1.0.0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class ZulipAdapter implements ChannelAdapter {
  readonly id = "zulip";
  readonly displayName = "Zulip";

  private readonly client: ZulipApiClient;
  private health: AdapterHealth = {
    ok: false,
    state: "idle",
    detail: null,
    lastEventAt: null,
  };
  private running = false;

  constructor(serverUrl: string, email: string, apiKey: string) {
    this.client = new ZulipApiClient(serverUrl, email, apiKey);
  }

  getCapabilities(): AdapterCapabilities {
    return {
      officiality: "open_protocol",
      supportsLiveStream: true,
      supportsHistoryFetch: true,
      supportsMembershipSnapshots: false,
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
      detail: "Registering Zulip event queue.",
      lastEventAt: this.health.lastEventAt,
    };

    let queueId: string;
    let lastEventId: number;
    try {
      const registered = await this.client.registerQueue();
      queueId = registered.queue_id;
      lastEventId = registered.last_event_id;
    } catch (error) {
      this.running = false;
      this.health = {
        ok: false,
        state: "error",
        detail: error instanceof Error ? error.message : "Zulip queue registration failed.",
        lastEventAt: this.health.lastEventAt,
      };
      throw error;
    }

    this.health = {
      ok: true,
      state: "ready",
      detail: "Polling Zulip event queue.",
      lastEventAt: this.health.lastEventAt,
    };

    while (this.running) {
      try {
        const events = await this.client.getEvents(queueId, lastEventId);

        for (const event of events) {
          const envelope = mapZulipEventToEnvelope(event, ADAPTER_VERSION);
          lastEventId += 1;

          if (envelope === null) {
            continue;
          }

          await emit(envelope);
          this.health = {
            ok: true,
            state: "ready",
            detail: "Polling Zulip event queue.",
            lastEventAt: envelope.delivery.observedAt,
          };
        }
      } catch (error) {
        if (!this.running) {
          break;
        }

        this.health = {
          ok: false,
          state: "degraded",
          detail: error instanceof Error ? error.message : "Zulip event polling failed.",
          lastEventAt: this.health.lastEventAt,
        };
        await sleep(5_000);
      }
    }

    this.health = {
      ok: false,
      state: "idle",
      detail: "Zulip adapter disconnected.",
      lastEventAt: this.health.lastEventAt,
    };
  }

  async disconnect(): Promise<void> {
    this.running = false;
  }

  async runBackfill(emit: IngestEmitter, options?: { limit?: number }): Promise<void> {
    const messages = await this.client.getMessages(options?.limit ?? 100);

    for (const message of messages) {
      const envelope = mapZulipEventToEnvelope({ type: "message", message }, ADAPTER_VERSION);
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
