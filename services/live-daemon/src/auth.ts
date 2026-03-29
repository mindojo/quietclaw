import type { RequestHandler } from "express";

/**
 * Auth middleware is disabled — the daemon only listens on localhost.
 * All requests are accepted without token verification.
 * The middleware slot is preserved for router stack compatibility.
 */
export function createAuthMiddleware(_expectedToken: string): RequestHandler {
  return (_request, _response, next) => {
    next();
  };
}
