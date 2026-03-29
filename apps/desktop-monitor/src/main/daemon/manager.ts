import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createLiveDaemonServer,
} from "../../../../../services/live-daemon/src/server";
import type { LiveDaemonState } from "../../../../../services/live-daemon/src/state";

type LiveDaemonServer = ReturnType<typeof createLiveDaemonServer>;
const STATUS_DIR = path.join(os.homedir(), ".quietclaw");
const STATUS_FILE = path.join(STATUS_DIR, "daemon-status.json");

export class DaemonManager {
  private server: LiveDaemonServer | null = null;
  private state: LiveDaemonState | null = null;
  private port = 38765;
  private lastUpdateAt: number | null = null;

  async start(): Promise<{ port: number }> {
    if (this.server && this.state) {
      return { port: this.port };
    }

    for (let port = 38765; port <= 38775; port += 1) {
      const nextServer = createLiveDaemonServer({
        host: "127.0.0.1",
        port,
      });

      try {
        const started = await nextServer.start();
        this.server = nextServer;
        this.state = started.state;
        this.port = started.port;
        this.writeStatusFile(started.port);
        return { port: started.port };
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : null;

        if (code !== "EADDRINUSE") {
          throw error;
        }
      }
    }

    throw new Error("No available daemon port in range 38765-38775.");
  }

  getState(): LiveDaemonState {
    if (!this.state) {
      throw new Error("Daemon is not started.");
    }

    return this.state;
  }

  getStatus(): {
    port: number;
    lastUpdateAt: number | null;
    messageCount: number;
    groupCount: number;
  } {
    return {
      port: this.port,
      lastUpdateAt: this.lastUpdateAt,
      messageCount: this.state?.getMessageCount() ?? 0,
      groupCount: this.state?.getGroupCount() ?? 0,
    };
  }

  onMessageReceived(): void {
    this.lastUpdateAt = Date.now();
  }

  async stop(): Promise<void> {
    if (!this.server) {
      this.removeStatusFile();
      return;
    }

    await this.server.stop();
    this.server = null;
    this.state = null;
    this.removeStatusFile();
  }

  private writeStatusFile(port: number): void {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({
        port,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }),
    );
  }

  private removeStatusFile(): void {
    try {
      fs.unlinkSync(STATUS_FILE);
    } catch {
      // Ignore missing status files during shutdown.
    }
  }
}
