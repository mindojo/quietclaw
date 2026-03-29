import type { Router } from "express";
import { z } from "zod";

import { NormalizedEventEnvelopeSchema } from "@quietclaw/ingest-contract";

import { mapNormalizedEventToGatewayMessage } from "../ingest-v2.js";
import type { LiveDaemonState } from "../state.js";
import { buildBatchAck, buildReceipt } from "../util/ack.js";
import type { EventReceipt } from "../util/ack.js";

const IngestV2RequestSchema = z.object({
  events: z.array(NormalizedEventEnvelopeSchema),
});

export function registerIngestV2Routes(router: Router, state: LiveDaemonState): void {
  router.post("/ingest/events", (request, response) => {
    const parsed = IngestV2RequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid ingest v2 payload.",
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const receipts: EventReceipt[] = [];

    for (const event of parsed.data.events) {
      const message = mapNormalizedEventToGatewayMessage(event);
      const stored = state.ingestMessage(
        message,
        event.conversation.displayName ?? event.conversation.nativeId,
      );
      receipts.push(
        buildReceipt(event.delivery.eventId, event.message.text, stored),
      );
    }

    response.json(buildBatchAck(receipts));
  });
}
