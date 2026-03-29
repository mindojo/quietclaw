import process from "node:process";
import { fileURLToPath } from "node:url";

export * from "./server.js";
export * from "./state.js";
export * from "./types.js";

import { createDefaultLiveDaemonServer } from "./server.js";

async function main(): Promise<void> {
  const daemon = createDefaultLiveDaemonServer();
  const started = await daemon.start();

  console.log(`QuietClaw live daemon listening on ${started.baseUrl}`);
  console.log(`HTTP ingest: ${started.baseUrl}/v1/events`);
  console.log(`HTTP ingest v2: ${started.baseUrl}/v2/ingest/events`);
  console.log(`WebSocket ingest: ws://${started.host}:${started.port}/ws`);

  const shutdown = async () => {
    await daemon.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

const isMain = process.argv[1]
  ? fileURLToPath(import.meta.url) === process.argv[1]
  : false;

if (isMain) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
