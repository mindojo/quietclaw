import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerPairRoute(router: Router, state: LiveDaemonState): void {
  router.get("/pair/qr", (_request, response) => {
    response.json(state.getPairQr());
  });
}
