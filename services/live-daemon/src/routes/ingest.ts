import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";

import type { Router } from "express";
import type { RawData } from "ws";
import { z } from "zod";

import type { LiveDaemonState } from "../state.js";
import { GatewayEnvelopeSchema } from "../types.js";
import { buildBatchAck, buildReceipt } from "../util/ack.js";
import type { EventReceipt } from "../util/ack.js";

const IngestRequestSchema = z.object({
  events: z.array(GatewayEnvelopeSchema),
});

const IngestBatchSchema = z.array(GatewayEnvelopeSchema);
const require = createRequire(import.meta.url);

function sendUpgradeUnauthorized(socket: Duplex): void {
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  socket.destroy();
}

function sendUpgradeNotFound(socket: Duplex): void {
  socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
  socket.destroy();
}

export function registerIngestRoutes(router: Router, state: LiveDaemonState): void {
  router.post("/events", (request, response) => {
    const parsed = IngestRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid ingest payload.",
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const receipts: EventReceipt[] = [];

    for (const event of parsed.data.events) {
      const { message, stored } = state.ingestEnvelope(event);
      receipts.push(buildReceipt(event.eventId, message.text, stored));
    }

    response.json(buildBatchAck(receipts));
  });
}

export function createIngestWebSocketHandler(
  state: LiveDaemonState,
) {
  const wsModule = require("ws") as {
    Server: new (options: { noServer: boolean }) => {
      on(event: "connection", listener: (socket: any) => void): void;
      handleUpgrade(
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
        callback: (client: any) => void,
      ): void;
      emit(event: "connection", client: any, request: IncomingMessage): void;
      close(callback: () => void): void;
    };
  };
  const wss = new wsModule.Server({ noServer: true });

  wss.on("connection", (socket: any) => {
    socket.on("message", (raw: RawData) => {
      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({
          type: "error",
          detail: "Invalid JSON payload.",
        }));
        return;
      }

      const parsedBatch = IngestBatchSchema.safeParse(parsedJson);
      if (!parsedBatch.success) {
        socket.send(JSON.stringify({
          type: "error",
          detail: "Invalid gateway envelope batch.",
        }));
        return;
      }

      const wsReceipts: EventReceipt[] = [];
      for (const event of parsedBatch.data) {
        const { message, stored } = state.ingestEnvelope(event);
        wsReceipts.push(buildReceipt(event.eventId, message.text, stored));
      }

      socket.send(JSON.stringify({
        type: "ack",
        ...buildBatchAck(wsReceipts),
      }));
    });
  });

  function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname !== "/ws") {
      sendUpgradeNotFound(socket);
      return;
    }

    // No auth — localhost only
    wss.handleUpgrade(request, socket, head, (client: any) => {
      wss.emit("connection", client, request);
    });
  }

  async function close(): Promise<void> {
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  }

  return {
    handleUpgrade,
    close,
  };
}
