import {
  initialBackfillGroups,
  newGroupAtNinetySeconds,
  newGroupsAtSixtySeconds,
  simulatorGroups,
  type SimGroup,
} from "./groups.js";
import { readDaemonUrlFromStatusFile, replayScenario } from "./replay.js";
import { pickGroupScenario } from "./scenarios.js";
import { createSimulatedEvent, sendBatch } from "./sender.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:38765";
const DEFAULT_TOKEN = "quietclaw-demo-token";
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pickRandomItem<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty collection.");
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? items[0]!;
}

function createBackfillPlan(): Array<{
  group: SimGroup;
  text: string;
  timestampMs: number;
}> {
  const totalMessages = 50 + Math.floor(Math.random() * 51);
  const now = Date.now();
  const startMs = now - 24 * 60 * 60 * 1000;

  return Array.from({ length: totalMessages }, (_value, index) => {
    const group = pickRandomItem(initialBackfillGroups);
    const progress = totalMessages === 1 ? 1 : index / (totalMessages - 1);
    const jitterMs = Math.floor(Math.random() * 10 * 60 * 1000);
    const timestampMs = Math.min(now - 5_000, startMs + Math.floor(progress * 24 * 60 * 60 * 1000) + jitterMs);

    return {
      group,
      text: pickGroupScenario(group.id),
      timestampMs,
    };
  }).sort((left, right) => left.timestampMs - right.timestampMs);
}

async function runBackfill(baseUrl: string, token: string): Promise<void> {
  const plan = createBackfillPlan();
  const batchCount = 10;
  const batchSize = Math.ceil(plan.length / batchCount);

  console.log(`Backfill: sending ${plan.length} messages across ${initialBackfillGroups.length} groups.`);

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const slice = plan.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    if (slice.length === 0) {
      continue;
    }

    const events = slice.map((entry) => {
      const sender = pickRandomItem(entry.group.senders);
      return createSimulatedEvent({
        group: entry.group,
        sender,
        text: entry.text,
        timestampMs: entry.timestampMs,
      });
    });

    for (const event of events) {
      event.delivery.isBackfill = true;
    }

    await sendBatch(baseUrl, token, events);
    console.log(`Backfill batch ${batchIndex + 1}/${batchCount}: ${events.length} messages sent.`);

    if (batchIndex < batchCount - 1) {
      await sleep(3_000);
    }
  }
}

async function runLive(baseUrl: string, token: string, startedAtMs: number): Promise<never> {
  const activeGroups = [...initialBackfillGroups];
  let sixtySecondGroupsAdded = false;
  let ninetySecondGroupAdded = false;

  while (true) {
    const elapsedMs = Date.now() - startedAtMs;

    if (!sixtySecondGroupsAdded && elapsedMs >= 60_000) {
      activeGroups.push(...newGroupsAtSixtySeconds);
      sixtySecondGroupsAdded = true;
      console.log(`Introduced ${newGroupsAtSixtySeconds.length} new groups at 60s.`);
    }

    if (!ninetySecondGroupAdded && elapsedMs >= 90_000) {
      activeGroups.push(...newGroupAtNinetySeconds);
      ninetySecondGroupAdded = true;
      console.log(`Introduced ${newGroupAtNinetySeconds.length} new group at 90s.`);
    }

    const group = pickRandomItem(activeGroups);
    const sender = pickRandomItem(group.senders);
    const event = createSimulatedEvent({
      group,
      sender,
      text: pickGroupScenario(group.id),
      timestampMs: Date.now(),
    });

    await sendBatch(baseUrl, token, [event]);
    console.log(`Live: ${group.title} <- ${sender.name}`);

    const delayMs = 2_000 + Math.floor(Math.random() * 3_001);
    await sleep(delayMs);
  }
}

async function main(): Promise<void> {
  const args = new Map<string, string | boolean>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const next = process.argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(arg, true);
      continue;
    }

    args.set(arg, next);
    index += 1;
  }

  const baseUrl = args.get("--port-from-status")
    ? readDaemonUrlFromStatusFile()
    : (typeof args.get("--daemon-url") === "string" ? String(args.get("--daemon-url")) : process.env.DAEMON_URL ?? DEFAULT_BASE_URL);
  const token = process.env.DAEMON_TOKEN ?? DEFAULT_TOKEN;
  const mode = typeof args.get("--mode") === "string" ? String(args.get("--mode")) : "live";
  const startedAtMs = Date.now();

  if (mode === "replay") {
    const scenario = args.get("--scenario");
    if (typeof scenario !== "string") {
      throw new Error("Replay mode requires --scenario <path>.");
    }

    const speed = typeof args.get("--speed") === "string"
      ? Number.parseFloat(String(args.get("--speed")))
      : 0;
    await replayScenario(scenario, baseUrl, token, Number.isFinite(speed) ? speed : 0);
    console.log(`Replay complete for ${scenario}.`);
    return;
  }

  console.log(`QuietClaw simulator targeting ${baseUrl}`);
  console.log(`Available groups: ${simulatorGroups.length}`);

  await runBackfill(baseUrl, token);
  console.log("Backfill complete. Entering live mode.");
  await runLive(baseUrl, token, startedAtMs);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
