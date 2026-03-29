import type { Router } from "express";

import type { LiveDaemonState } from "../state.js";

export function registerMembersRoute(router: Router, state: LiveDaemonState): void {
  router.get("/groups/:groupId/members", (request, response) => {
    const payload = state.getGroupMembers(request.params.groupId);
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
