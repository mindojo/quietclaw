import type { Router } from "express";
import { UtcIsoDatetimeSchema } from "@quietclaw/gateway-contract";
import { z } from "zod";

import type { LiveDaemonState } from "../state.js";

const MessagesQuerySchema = z.object({
  since: UtcIsoDatetimeSchema,
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  cursor: z.string().nullable().default(null),
});

export function registerMessagesRoute(router: Router, state: LiveDaemonState): void {
  router.get("/groups/:groupId/messages", (request, response) => {
    const parsedQuery = MessagesQuerySchema.safeParse({
      since: request.query.since,
      limit: request.query.limit ?? 500,
      cursor: request.query.cursor ?? null,
    });

    if (!parsedQuery.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid messages query.",
          details: parsedQuery.error.flatten(),
        },
      });
      return;
    }

    const payload = state.getMessages({
      groupId: request.params.groupId,
      ...parsedQuery.data,
    });

    if (payload === null) {
      response.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Group not found.",
        },
      });
      return;
    }

    response.json(payload);
  });
}
