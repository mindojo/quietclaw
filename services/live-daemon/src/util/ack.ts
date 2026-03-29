import { createHash } from "node:crypto";

/**
 * An individual event receipt proving the daemon processed a specific event.
 *
 * External services can verify receipt by checking:
 * - `eventId` matches what they sent
 * - `contentHash` matches SHA-256 of the message text they sent
 * - `byteLength` matches the UTF-8 byte length of the text they sent
 * - `stored` is true (false means the event was a duplicate or was filtered)
 */
export type EventReceipt = {
  /** The event ID, echoed from the ingest payload. */
  eventId: string;
  /** ISO-8601 timestamp when the daemon received this event. */
  receivedAt: string;
  /** SHA-256 hex digest of the message text (or "" if text was null/empty). */
  contentHash: string;
  /** UTF-8 byte length of the message text (0 if null). */
  byteLength: number;
  /** True if the event was stored. False if it was a duplicate or filtered out. */
  stored: boolean;
};

/**
 * Batch acknowledgement response from the ingest endpoint.
 */
export type IngestAck = {
  /** Protocol version for the ack format. */
  ackVersion: "1.0";
  /** True if the batch was accepted (even if individual events were filtered). */
  accepted: boolean;
  /** Number of events in the batch. */
  batchSize: number;
  /** Number of events that were actually stored (not duplicates). */
  storedCount: number;
  /** Per-event receipts, in the same order as the input events. */
  receipts: EventReceipt[];
};

/**
 * Build a receipt for a single event.
 */
export function buildReceipt(
  eventId: string,
  text: string | null | undefined,
  stored: boolean,
): EventReceipt {
  const textStr = text ?? "";
  const textBytes = Buffer.from(textStr, "utf-8");
  const contentHash = textStr.length > 0
    ? createHash("sha256").update(textBytes).digest("hex")
    : "";

  return {
    eventId,
    receivedAt: new Date().toISOString(),
    contentHash,
    byteLength: textBytes.byteLength,
    stored,
  };
}

/**
 * Build the full batch ack response.
 */
export function buildBatchAck(receipts: EventReceipt[]): IngestAck {
  return {
    ackVersion: "1.0",
    accepted: true,
    batchSize: receipts.length,
    storedCount: receipts.filter((r) => r.stored).length,
    receipts,
  };
}
