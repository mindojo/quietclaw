import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerCapabilitiesRoute(router: Router, state: LiveDaemonState): void {
  router.get("/capabilities", (_request, response) => {
    response.json(state.getCapabilities());
  });
}
