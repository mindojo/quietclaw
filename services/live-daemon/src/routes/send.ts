import type { Router } from "express";
import { SendMessageRequestSchema } from "@quietclaw/gateway-contract";

import type { LiveDaemonState } from "../state.js";

export function registerSendRoute(router: Router, state: LiveDaemonState): void {
  router.post("/messages/send", (request, response) => {
    const parsed = SendMessageRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid send request.",
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const payload = state.sendMessage(parsed.data);
    if (payload === null) {
      response.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Target group not found.",
        },
      });
      return;
    }

    response.json(payload);
  });
}
