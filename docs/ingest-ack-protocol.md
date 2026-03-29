# QuietClaw Ingest Acknowledgement Protocol

**Version:** 1.0
**Last updated:** 2026-03-28

## Overview

When an external service sends events to the QuietClaw daemon via the ingest endpoints, the daemon returns a structured acknowledgement (ack) proving it received and processed each event. This allows senders to verify that their messages were not just received, but actually parsed and stored.

## Endpoints that return acks

| Endpoint | Method | Auth |
|----------|--------|------|
| `/v1/events` | POST | Bearer token |
| `/v2/ingest/events` | POST | Bearer token |
| `/ws` | WebSocket | Token in query param |

## Response format

### HTTP endpoints (v1 and v2)

```json
{
  "ackVersion": "1.0",
  "accepted": true,
  "batchSize": 3,
  "storedCount": 2,
  "receipts": [
    {
      "eventId": "grp_001:ABC123",
      "receivedAt": "2026-03-28T10:30:00.123Z",
      "contentHash": "a1b2c3d4e5f6...",
      "byteLength": 42,
      "stored": true
    },
    {
      "eventId": "grp_001:DEF456",
      "receivedAt": "2026-03-28T10:30:00.125Z",
      "contentHash": "f6e5d4c3b2a1...",
      "byteLength": 55,
      "stored": true
    },
    {
      "eventId": "grp_001:GHI789",
      "receivedAt": "2026-03-28T10:30:00.127Z",
      "contentHash": "a1b2c3d4e5f6...",
      "byteLength": 42,
      "stored": false
    }
  ]
}
```

### WebSocket

```json
{
  "type": "ack",
  "ackVersion": "1.0",
  "accepted": true,
  "batchSize": 1,
  "storedCount": 1,
  "receipts": [...]
}
```

## Field definitions

### Batch-level fields

| Field | Type | Description |
|-------|------|-------------|
| `ackVersion` | `"1.0"` | Protocol version. Always `"1.0"` for this version. |
| `accepted` | `boolean` | `true` if the batch was accepted for processing. |
| `batchSize` | `number` | Number of events in the submitted batch. |
| `storedCount` | `number` | Number of events that were actually stored (not duplicates). |
| `receipts` | `EventReceipt[]` | Per-event receipts, in the same order as the submitted events. |

### Per-event receipt fields

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | `string` | The event ID from the submitted event, echoed back for correlation. |
| `receivedAt` | `string` | ISO-8601 timestamp when the daemon processed this event. |
| `contentHash` | `string` | SHA-256 hex digest of the message text (UTF-8 encoded). Empty string if text was null. |
| `byteLength` | `number` | UTF-8 byte length of the message text. `0` if text was null. |
| `stored` | `boolean` | `true` if the event was stored in the daemon's message buffer. `false` if it was a duplicate (same message ID already seen) or filtered out. |

## Sender-side verification

External services can verify that the daemon correctly received their message by recomputing the `contentHash` and `byteLength` locally:

### JavaScript / TypeScript

```javascript
import { createHash } from "crypto";

function verifyReceipt(originalText, receipt) {
  const textBytes = Buffer.from(originalText ?? "", "utf-8");
  const expectedHash = originalText
    ? createHash("sha256").update(textBytes).digest("hex")
    : "";
  const expectedBytes = textBytes.byteLength;

  return (
    receipt.contentHash === expectedHash &&
    receipt.byteLength === expectedBytes
  );
}
```

### Python

```python
import hashlib

def verify_receipt(original_text: str | None, receipt: dict) -> bool:
    text = original_text or ""
    text_bytes = text.encode("utf-8")
    expected_hash = hashlib.sha256(text_bytes).hexdigest() if text else ""
    expected_bytes = len(text_bytes)
    return (
        receipt["contentHash"] == expected_hash
        and receipt["byteLength"] == expected_bytes
    )
```

### Go

```go
import (
    "crypto/sha256"
    "encoding/hex"
)

func verifyReceipt(originalText string, contentHash string, byteLength int) bool {
    textBytes := []byte(originalText)
    hash := sha256.Sum256(textBytes)
    expectedHash := hex.EncodeToString(hash[:])
    return contentHash == expectedHash && byteLength == len(textBytes)
}
```

## What the ack proves

| Verification | How |
|-------------|-----|
| **The daemon received the event** | `eventId` echoed back matches what you sent |
| **The daemon read the message content** | `contentHash` matches your local SHA-256 of the message text |
| **The content was not truncated** | `byteLength` matches your local UTF-8 byte length |
| **The event was actually stored** | `stored === true` (vs duplicate/filtered) |
| **Timing** | `receivedAt` gives the server-side receipt time |

## Duplicate detection

If the daemon has already seen an event with the same message ID, it returns `stored: false`. The `contentHash` and `byteLength` are still computed from the submitted content — this lets you verify the duplicate detection was based on the correct content.

## Test messages

External services can send test messages to verify the ack protocol works:

### Minimal test event (v2 endpoint)

```bash
curl -X POST http://127.0.0.1:38765/v2/ingest/events \
  -H "Authorization: Bearer quietclaw-demo-token" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "schemaVersion": "1.0",
      "adapter": { "id": "test", "version": "1.0.0", "officiality": "experimental" },
      "delivery": {
        "mode": "manual_import",
        "eventType": "message.created",
        "eventId": "test-001",
        "occurredAt": "2026-03-28T10:00:00Z",
        "observedAt": "2026-03-28T10:00:00Z",
        "isBackfill": false
      },
      "conversation": {
        "id": "test-group",
        "nativeId": "test-group",
        "kind": "group",
        "displayName": "Ack Test Group",
        "tenantId": null,
        "threadId": null
      },
      "actor": {
        "id": "test-user",
        "nativeId": "test-user",
        "displayName": "Test User",
        "handle": null,
        "isBot": false
      },
      "message": {
        "id": "test-msg-001",
        "nativeId": "test-msg-001",
        "text": "Hello, ack protocol!",
        "html": null,
        "attachments": [],
        "replyToMessageId": null,
        "edited": false,
        "languageHint": null
      },
      "capabilities": { "history": "none", "membership": "none" },
      "sourceMeta": {}
    }]
  }'
```

### Expected response

```json
{
  "ackVersion": "1.0",
  "accepted": true,
  "batchSize": 1,
  "storedCount": 1,
  "receipts": [{
    "eventId": "test-001",
    "receivedAt": "2026-03-28T10:00:01.234Z",
    "contentHash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "byteLength": 20,
    "stored": true
  }]
}
```

The expected contentHash above is `SHA-256("Hello, ack protocol!")`. You can verify:

```bash
echo -n "Hello, ack protocol!" | shasum -a 256
# b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
```

### Verifying duplicate detection

Send the same event again (same `message.id`). The response should have `stored: false`:

```bash
# Send same event again...
# Expected: storedCount: 0, receipt.stored: false
```

### Test with Unicode content

```bash
# Hebrew text: "דחוף: הטיול מחר בוטל"
# UTF-8 byte length: 38 (not 20, because Hebrew chars are 2 bytes each)
# contentHash: SHA-256 of the UTF-8 bytes
```

## Error responses

If the batch payload is invalid (fails Zod schema validation), the endpoint returns HTTP 400:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid ingest v2 payload.",
    "details": { ... }
  }
}
```

No receipts are returned for invalid batches — fix the payload and resend.

## Version history

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-28 | Initial release. SHA-256 content hash, byte length, stored flag, batch counts. |
