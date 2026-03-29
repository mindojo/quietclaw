import http from "node:http";

import express from "express";

import { createAuthMiddleware } from "./auth.js";
import { DEFAULT_HOST, DEFAULT_PORT, DEFAULT_TOKEN } from "./constants.js";
import { registerCapabilitiesRoute } from "./routes/capabilities.js";
import { registerEventsRoute } from "./routes/events.js";
import { registerGroupsRoute } from "./routes/groups.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerHideRoute } from "./routes/hide.js";
import { registerIngestRoutes, createIngestWebSocketHandler } from "./routes/ingest.js";
import { registerIngestV2Routes } from "./routes/ingest-v2.js";
import { registerMembersRoute } from "./routes/members.js";
import { registerMessagesRoute } from "./routes/messages.js";
import { registerPairRoute } from "./routes/pair.js";
import { registerSendRoute } from "./routes/send.js";
import { type LiveDaemonConfig, LiveDaemonState } from "./state.js";
import { type Clock } from "./util/clock.js";

export type StartedLiveDaemon = {
  host: string;
  port: number;
  baseUrl: string;
  server: http.Server;
  state: LiveDaemonState;
};

export function createLiveDaemonServer(
  options: Partial<LiveDaemonConfig> & {
    clock?: Clock;
  } = {},
) {
  const state = new LiveDaemonState(options);
  const app = express();
  const router = express.Router();
  const routerV2 = express.Router();
  const ingestSockets = createIngestWebSocketHandler(state);
  let server: http.Server | null = null;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json(state.getPublicHealth());
  });

  // Auth is disabled (passthrough) — daemon only listens on localhost
  router.use(createAuthMiddleware(options.token ?? DEFAULT_TOKEN));
  registerCapabilitiesRoute(router, state);
  registerHealthRoute(router, state);
  registerPairRoute(router, state);
  registerGroupsRoute(router, state);
  registerMembersRoute(router, state);
  registerMessagesRoute(router, state);
  registerSendRoute(router, state);
  registerEventsRoute(router, state);
  registerIngestRoutes(router, state);
  registerHideRoute(router, state);
  app.use("/v1", router);

  routerV2.use(createAuthMiddleware(options.token ?? DEFAULT_TOKEN));
  registerIngestV2Routes(routerV2, state);
  app.use("/v2", routerV2);

  return {
    app,
    state,
    async start(): Promise<StartedLiveDaemon> {
      if (server !== null) {
        const address = server.address();
        if (address === null || typeof address === "string") {
          throw new Error("Live daemon server address is unavailable.");
        }

        return {
          host: address.address,
          port: address.port,
          baseUrl: formatBaseUrl(address.address, address.port),
          server,
          state,
        };
      }

      state.start();
      server = http.createServer(app);
      server.on("upgrade", ingestSockets.handleUpgrade);

      await new Promise<void>((resolve, reject) => {
        server?.listen(options.port ?? DEFAULT_PORT, options.host ?? DEFAULT_HOST);
        server?.once("listening", () => resolve());
        server?.once("error", reject);
      });

      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Live daemon server address is unavailable.");
      }

      return {
        host: address.address,
        port: address.port,
        baseUrl: formatBaseUrl(address.address, address.port),
        server,
        state,
      };
    },
    async stop(): Promise<void> {
      state.stop();
      await ingestSockets.close();

      if (server === null) {
        return;
      }

      const activeServer = server;
      server = null;
      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

function formatBaseUrl(host: string, port: number): string {
  if (host === "0.0.0.0") {
    return `http://127.0.0.1:${port}`;
  }

  if (host.includes(":")) {
    const resolvedHost = host === "::" ? "::1" : host;
    return `http://[${resolvedHost}]:${port}`;
  }

  return `http://${host}:${port}`;
}

export function createDefaultLiveDaemonServer() {
  return createLiveDaemonServer({
    host: process.env.DAEMON_HOST ?? DEFAULT_HOST,
    port: Number.parseInt(process.env.DAEMON_PORT ?? String(DEFAULT_PORT), 10),
    token: process.env.DAEMON_TOKEN ?? DEFAULT_TOKEN,
  });
}
