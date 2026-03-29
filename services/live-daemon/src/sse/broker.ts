import type { Response } from "express";
import { EventEnvelopeSchema } from "@quietclaw/gateway-contract";

import { HEARTBEAT_INTERVAL_MS } from "../constants.js";
import type { Clock } from "../util/clock.js";
import { createSseClientId } from "../util/ids.js";

type SseClient = {
  id: string;
  response: Response;
};

export class SseBroker {
  private readonly clients = new Map<string, SseClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly clock: Clock) {}

  start(): void {
    if (this.heartbeatTimer !== null) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.emit("heartbeat", {
        unixMs: this.clock.nowMs(),
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients.values()) {
      client.response.end();
    }

    this.clients.clear();
  }

  addClient(response: Response): string {
    const id = createSseClientId();
    this.clients.set(id, { id, response });
    response.on("close", () => {
      this.clients.delete(id);
    });
    return id;
  }

  emit(event: string, payload: unknown): void {
    const envelope = EventEnvelopeSchema.parse({
      type: event,
      emittedAt: this.clock.nowIso(),
      payload,
    });
    const chunk = `event: ${event}\ndata: ${JSON.stringify(envelope)}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      try {
        client.response.write(chunk);
      } catch {
        client.response.end();
        this.clients.delete(id);
      }
    }
  }
}
