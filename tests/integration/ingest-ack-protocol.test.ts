import { createHash } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import { createLiveDaemonServer } from "../../services/live-daemon/src/server.js";
import type { IngestAckResponse } from "../../services/simulator/src/sender.js";

const PORT = 39821;
const TOKEN = "test-ack-token";
const BASE = `http://127.0.0.1:${PORT}`;

describe("ingest ack protocol (integration)", () => {
  let daemon: Awaited<ReturnType<ReturnType<typeof createLiveDaemonServer>["start"]>>;
  let stop: (() => Promise<void>) | null = null;
  let startupBlocked = false;

  beforeAll(async () => {
    try {
      const d = createLiveDaemonServer({ host: "127.0.0.1", port: PORT, token: TOKEN });
      daemon = await d.start();
      stop = d.stop;
    } catch (error) {
      if (isListenPermissionError(error)) {
        startupBlocked = true;
        return;
      }

      throw error;
    }
  });

  afterAll(async () => {
    await stop?.();
  });

  it("POST /v2/ingest/events returns per-event receipts", async () => {
    if (startupBlocked) {
      return;
    }

    const text = "Urgent: water leak in building 3";
    const eventId = "test-ack-001";

    const response = await fetch(`${BASE}/v2/ingest/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            schemaVersion: "1.0",
            adapter: { id: "test", version: "1.0.0", officiality: "experimental" },
            delivery: {
              mode: "simulated",
              eventType: "message.created",
              eventId,
              occurredAt: new Date().toISOString(),
              observedAt: new Date().toISOString(),
              isBackfill: false,
            },
            conversation: {
              id: "grp_test",
              nativeId: "grp_test",
              kind: "group",
              displayName: "Test Group",
              tenantId: null,
              threadId: null,
            },
            actor: {
              id: "user_1",
              nativeId: "user_1",
              displayName: "Test User",
              handle: null,
              isBot: false,
            },
            message: {
              id: "msg-001",
              nativeId: "msg-001",
              text,
              html: null,
              attachments: [],
              replyToMessageId: null,
              edited: false,
              languageHint: null,
            },
            capabilities: { history: "none", membership: "none" },
            sourceMeta: {},
          },
        ],
      }),
    });

    expect(response.ok).toBe(true);
    const ack = (await response.json()) as IngestAckResponse;

    // Verify batch-level fields
    expect(ack.ackVersion).toBe("1.0");
    expect(ack.accepted).toBe(true);
    expect(ack.batchSize).toBe(1);
    expect(ack.storedCount).toBe(1);

    // Verify per-event receipt
    const receipt = ack.receipts[0]!;
    expect(receipt.eventId).toBe(eventId);
    expect(receipt.stored).toBe(true);
    expect(receipt.receivedAt).toBeTruthy();

    // Verify content hash (sender-side verification)
    const expectedHash = createHash("sha256")
      .update(Buffer.from(text, "utf-8"))
      .digest("hex");
    expect(receipt.contentHash).toBe(expectedHash);
    expect(receipt.byteLength).toBe(Buffer.from(text, "utf-8").byteLength);
  });

  it("duplicate event returns stored=false with same hash", async () => {
    if (startupBlocked) {
      return;
    }

    const text = "Urgent: water leak in building 3";
    const eventId = "test-ack-001"; // same ID as above

    const response = await fetch(`${BASE}/v2/ingest/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            schemaVersion: "1.0",
            adapter: { id: "test", version: "1.0.0", officiality: "experimental" },
            delivery: {
              mode: "simulated",
              eventType: "message.created",
              eventId,
              occurredAt: new Date().toISOString(),
              observedAt: new Date().toISOString(),
              isBackfill: false,
            },
            conversation: {
              id: "grp_test",
              nativeId: "grp_test",
              kind: "group",
              displayName: "Test Group",
              tenantId: null,
              threadId: null,
            },
            actor: {
              id: "user_1",
              nativeId: "user_1",
              displayName: "Test User",
              handle: null,
              isBot: false,
            },
            message: {
              id: "msg-001", // same message ID → duplicate
              nativeId: "msg-001",
              text,
              html: null,
              attachments: [],
              replyToMessageId: null,
              edited: false,
              languageHint: null,
            },
            capabilities: { history: "none", membership: "none" },
            sourceMeta: {},
          },
        ],
      }),
    });

    const ack = (await response.json()) as IngestAckResponse;
    expect(ack.storedCount).toBe(0);
    expect(ack.receipts[0]!.stored).toBe(false);
    // Hash is still correct even for duplicates
    const expectedHash = createHash("sha256")
      .update(Buffer.from(text, "utf-8"))
      .digest("hex");
    expect(ack.receipts[0]!.contentHash).toBe(expectedHash);
  });
});

function isListenPermissionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("listen EPERM");
}
