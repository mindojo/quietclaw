import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerHideRoute(router: Router, state: LiveDaemonState): void {
  router.post("/groups/:groupId/hide", (request, response) => {
    state.hideGroup(request.params.groupId);
    response.json({
      ok: true,
      groupId: request.params.groupId,
    });
  });
}
