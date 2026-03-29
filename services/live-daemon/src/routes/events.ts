import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerEventsRoute(router: Router, state: LiveDaemonState): void {
  router.get("/events/stream", (_request, response) => {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();
    state.broker.addClient(response);
  });
}
