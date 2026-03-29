import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerGroupsRoute(router: Router, state: LiveDaemonState): void {
  router.get("/groups", (_request, response) => {
    response.json(state.getGroups());
  });
}
