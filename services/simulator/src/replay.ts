import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import { createSimulatedEvent } from "./sender.js";

type ScenarioEvent = {
  type: "message";
  mode: "live" | "backfill";
  at: string;
  conversation_id: string;
  conversation_title: string;
  sender_id: string;
  sender_name: string;
  text: string | null;
  caption?: string | null;
};

type Scenario = {
  id: string;
  events: ScenarioEvent[];
};

export async function replayScenario(
  scenarioPath: string,
  daemonUrl: string,
  token: string,
  speed = 0,
): Promise<void> {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8")) as Scenario;
  const sortedEvents = [...scenario.events].sort((left, right) => left.at.localeCompare(right.at));
  let previousAt: string | null = null;

  for (const event of sortedEvents) {
    if (previousAt && speed > 0) {
      const gapMs = new Date(event.at).getTime() - new Date(previousAt).getTime();
      const waitMs = Math.max(0, Math.floor(gapMs / speed));
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }

    await postEvents(daemonUrl, token, [toEnvelope(event)]);
    previousAt = event.at;
  }
}

export function readDaemonUrlFromStatusFile(): string {
  const statusPath = path.join(os.homedir(), ".quietclaw", "daemon-status.json");
  const status = JSON.parse(fs.readFileSync(statusPath, "utf8")) as { port: number };
  return `http://127.0.0.1:${status.port}`;
}

async function postEvents(baseUrl: string, token: string, events: NormalizedEventEnvelope[]): Promise<void> {
  const response = await fetch(new URL("/v2/ingest/events", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    throw new Error(`Replay ingest failed: ${response.status} ${await response.text()}`);
  }
}

function toEnvelope(event: ScenarioEvent): NormalizedEventEnvelope {
  const normalized = createSimulatedEvent({
    group: {
      id: event.conversation_id,
      title: event.conversation_title,
      senders: [{ id: event.sender_id, name: event.sender_name }],
    },
    sender: {
      id: event.sender_id,
      name: event.sender_name,
    },
    text: event.text ?? event.caption ?? "",
    timestampMs: new Date(event.at).getTime(),
  });

  normalized.delivery.isBackfill = event.mode === "backfill";
  normalized.delivery.observedAt = new Date(
    event.mode === "live"
      ? new Date(event.at).getTime()
      : new Date(event.at).getTime() + 10 * 60 * 1000,
  ).toISOString();
  normalized.sourceMeta = {
    ...normalized.sourceMeta,
    hookSource: "replay",
  };

  return normalized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
