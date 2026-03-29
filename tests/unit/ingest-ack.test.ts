import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildBatchAck, buildReceipt } from "../../services/live-daemon/src/util/ack.js";

describe("ingest ack protocol", () => {
  it("builds a receipt with correct content hash and byte length", () => {
    const text = "Hello, world!";
    const receipt = buildReceipt("evt-001", text, true);

    expect(receipt.eventId).toBe("evt-001");
    expect(receipt.stored).toBe(true);
    expect(receipt.byteLength).toBe(Buffer.from(text, "utf-8").byteLength);
    expect(receipt.contentHash).toBe(
      createHash("sha256").update(Buffer.from(text, "utf-8")).digest("hex"),
    );
    expect(receipt.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("handles null text with empty hash and zero bytes", () => {
    const receipt = buildReceipt("evt-002", null, true);

    expect(receipt.contentHash).toBe("");
    expect(receipt.byteLength).toBe(0);
    expect(receipt.stored).toBe(true);
  });

  it("handles Unicode text correctly (Hebrew)", () => {
    const text = "דחוף: הטיול מחר בוטל";
    const receipt = buildReceipt("evt-003", text, true);
    const expected = Buffer.from(text, "utf-8");

    expect(receipt.byteLength).toBe(expected.byteLength);
    expect(receipt.contentHash).toBe(
      createHash("sha256").update(expected).digest("hex"),
    );
    // UTF-8 byte length > string length for Hebrew
    expect(receipt.byteLength).toBeGreaterThan(text.length);
  });

  it("marks duplicate events as stored=false", () => {
    const receipt = buildReceipt("evt-004", "duplicate message", false);
    expect(receipt.stored).toBe(false);
    // Hash is still computed even for duplicates (sender can verify content)
    expect(receipt.contentHash).toBeTruthy();
  });

  it("builds a batch ack with correct counts", () => {
    const receipts = [
      buildReceipt("evt-010", "first", true),
      buildReceipt("evt-011", "second", true),
      buildReceipt("evt-012", "duplicate", false),
    ];
    const ack = buildBatchAck(receipts);

    expect(ack.ackVersion).toBe("1.0");
    expect(ack.accepted).toBe(true);
    expect(ack.batchSize).toBe(3);
    expect(ack.storedCount).toBe(2);
    expect(ack.receipts).toHaveLength(3);
    expect(ack.receipts[2]?.stored).toBe(false);
  });

  it("sender can verify receipt by recomputing hash", () => {
    const originalText = "Reminder: tomorrow's class meeting moved to 18:30.";
    const receipt = buildReceipt("evt-100", originalText, true);

    // Sender-side verification:
    const senderHash = createHash("sha256")
      .update(Buffer.from(originalText, "utf-8"))
      .digest("hex");
    const senderBytes = Buffer.from(originalText, "utf-8").byteLength;

    expect(receipt.contentHash).toBe(senderHash);
    expect(receipt.byteLength).toBe(senderBytes);
  });
});
