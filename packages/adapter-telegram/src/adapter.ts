import type { AdapterCapabilities, AdapterHealth, ChannelAdapter, IngestEmitter } from "@quietclaw/adapter-sdk";

import { TelegramApiClient } from "./client.js";
import { mapTelegramUpdateToEvent } from "./mapper.js";

const ADAPTER_VERSION = "1.0.0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("429");
}

export class TelegramAdapter implements ChannelAdapter {
  readonly id = "telegram";
  readonly displayName = "Telegram";

  private readonly client: TelegramApiClient;
  private health: AdapterHealth = {
    ok: false,
    state: "idle",
    detail: null,
    lastEventAt: null,
  };
  private running = false;

  constructor(token: string) {
    this.client = new TelegramApiClient(token);
  }

  getCapabilities(): AdapterCapabilities {
    return {
      officiality: "official",
      supportsLiveStream: true,
      supportsHistoryFetch: false,
      supportsMembershipSnapshots: false,
      supportsThreads: false,
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
      detail: "Verifying Telegram bot token.",
      lastEventAt: this.health.lastEventAt,
    };

    try {
      await this.client.getMe();
    } catch (error) {
      this.running = false;
      this.health = {
        ok: false,
        state: "error",
        detail: error instanceof Error ? error.message : "Telegram authentication failed.",
        lastEventAt: this.health.lastEventAt,
      };
      throw error;
    }

    this.health = {
      ok: true,
      state: "ready",
      detail: "Polling Telegram updates.",
      lastEventAt: this.health.lastEventAt,
    };

    let offset: number | undefined;

    while (this.running) {
      try {
        const updates = await this.client.getUpdates(offset, 30);

        for (const update of updates) {
          const event = mapTelegramUpdateToEvent(update, ADAPTER_VERSION);
          offset = Math.max(offset ?? update.update_id, update.update_id) + 1;

          if (event !== null) {
            await emit(event);
            this.health = {
              ok: true,
              state: "ready",
              detail: "Polling Telegram updates.",
              lastEventAt: event.delivery.observedAt,
            };
          }
        }
      } catch (error) {
        if (!this.running) {
          break;
        }

        this.health = {
          ok: false,
          state: "degraded",
          detail: error instanceof Error ? error.message : "Telegram polling failed.",
          lastEventAt: this.health.lastEventAt,
        };

        if (isRateLimitError(error)) {
          await sleep(5_000);
          continue;
        }

        await sleep(5_000);
      }
    }

    this.health = {
      ok: false,
      state: "idle",
      detail: "Telegram adapter disconnected.",
      lastEventAt: this.health.lastEventAt,
    };
  }

  async disconnect(): Promise<void> {
    this.running = false;
  }
}
