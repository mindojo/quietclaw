import type { AdapterCapabilities, AdapterHealth, ChannelAdapter, IngestEmitter } from "@quietclaw/adapter-sdk";

import { DiscordApiClient } from "./client.js";
import { mapDiscordEventToEnvelope } from "./mapper.js";
import type { DiscordGatewayDispatch, DiscordGatewayHello, DiscordMessage, DiscordMessageDeleteEvent } from "./types.js";

const ADAPTER_VERSION = "1.0.0";
const MESSAGE_CONTENT_INTENT = 1 << 15;
const GUILD_MESSAGES_INTENT = 1 << 9;
const DIRECT_MESSAGES_INTENT = 1 << 12;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class DiscordAdapter implements ChannelAdapter {
  readonly id = "discord";
  readonly displayName = "Discord";

  private readonly client: DiscordApiClient;
  private readonly token: string;
  private health: AdapterHealth = {
    ok: false,
    state: "idle",
    detail: null,
    lastEventAt: null,
  };
  private running = false;
  private socket: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sequence: number | null = null;

  constructor(token: string) {
    this.token = token;
    this.client = new DiscordApiClient(token);
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
      detail: "Connecting to Discord Gateway.",
      lastEventAt: this.health.lastEventAt,
    };

    while (this.running) {
      try {
        const gateway = await this.client.getGateway();
        await this.runGatewayLoop(`${gateway.url}?v=10&encoding=json`, emit);
      } catch (error) {
        if (!this.running) {
          break;
        }

        this.health = {
          ok: false,
          state: "degraded",
          detail: error instanceof Error ? error.message : "Discord Gateway connection failed.",
          lastEventAt: this.health.lastEventAt,
        };
        await sleep(5_000);
      }
    }

    this.health = {
      ok: false,
      state: "idle",
      detail: "Discord adapter disconnected.",
      lastEventAt: this.health.lastEventAt,
    };
  }

  async disconnect(): Promise<void> {
    this.running = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private async runGatewayLoop(gatewayUrl: string, emit: IngestEmitter): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(gatewayUrl);
      this.socket = socket;

      socket.addEventListener("message", async (rawMessage) => {
        try {
          const payload = JSON.parse(String(rawMessage.data)) as DiscordGatewayDispatch<unknown>;
          this.sequence = payload.s ?? this.sequence;

          if (payload.op === 10) {
            const hello = payload.d as DiscordGatewayHello;
            this.startHeartbeat(socket, hello.heartbeat_interval);
            socket.send(JSON.stringify({
              op: 2,
              d: {
                token: this.token,
                intents: MESSAGE_CONTENT_INTENT | GUILD_MESSAGES_INTENT | DIRECT_MESSAGES_INTENT,
                properties: {
                  os: process.platform,
                  browser: "quietclaw",
                  device: "quietclaw",
                },
              },
            }));
            return;
          }

          if (payload.op !== 0 || !payload.t) {
            return;
          }

          const mapped = this.mapDispatch(payload.t, payload.d);
          if (mapped === null) {
            return;
          }

          const envelope = mapDiscordEventToEnvelope(mapped, ADAPTER_VERSION);
          if (envelope === null) {
            return;
          }

          this.health = {
            ok: true,
            state: "ready",
            detail: "Listening to Discord Gateway events.",
            lastEventAt: envelope.delivery.observedAt,
          };
          await emit(envelope);
        } catch (error) {
          this.health = {
            ok: false,
            state: "degraded",
            detail: error instanceof Error ? error.message : "Discord event parsing failed.",
            lastEventAt: this.health.lastEventAt,
          };
        }
      });

      socket.addEventListener("open", () => {
        this.health = {
          ok: false,
          state: "connecting",
          detail: "Waiting for Discord Gateway hello.",
          lastEventAt: this.health.lastEventAt,
        };
      });

      socket.addEventListener("close", () => {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        this.socket = null;
        resolve();
      });

      socket.addEventListener("error", () => {
        reject(new Error("Discord Gateway transport error."));
      });
    });
  }

  private startHeartbeat(socket: WebSocket, intervalMs: number): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      socket.send(JSON.stringify({
        op: 1,
        d: this.sequence,
      }));
    }, intervalMs);
  }

  private mapDispatch(
    type: string,
    data: unknown,
  ):
    | { type: "MESSAGE_CREATE"; data: DiscordMessage }
    | { type: "MESSAGE_UPDATE"; data: DiscordMessage }
    | { type: "MESSAGE_DELETE"; data: DiscordMessageDeleteEvent }
    | null {
    if (type === "MESSAGE_CREATE") {
      return { type, data: data as DiscordMessage };
    }
    if (type === "MESSAGE_UPDATE") {
      return { type, data: data as DiscordMessage };
    }
    if (type === "MESSAGE_DELETE") {
      return { type, data: data as DiscordMessageDeleteEvent };
    }
    return null;
  }
}
