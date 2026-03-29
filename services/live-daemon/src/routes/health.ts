import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerHealthRoute(router: Router, state: LiveDaemonState): void {
  router.get("/health", (_request, response) => {
    response.json(state.getHealth());
  });
}
