import { describe, expect, test } from "vitest";

import type { NormalizedEventEnvelope } from "../../packages/ingest-contract/src/index.js";
import { mapNormalizedEventToGatewayMessage } from "../../services/live-daemon/src/ingest-v2.js";

function createEvent(): NormalizedEventEnvelope {
  return {
    schemaVersion: "1.0",
    adapter: {
      id: "telegram",
      version: "1.0.0",
      officiality: "official",
    },
    delivery: {
      mode: "poll",
      eventType: "message.created",
      eventId: "evt-1",
      occurredAt: "2026-03-28T12:00:00.000Z",
      observedAt: "2026-03-28T12:00:01.000Z",
      isBackfill: false,
    },
    conversation: {
      id: "telegram:-100",
      nativeId: "-100",
      kind: "group",
      displayName: "Ops",
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: "telegram:1",
      nativeId: "1",
      displayName: "Alice",
      handle: "alice",
      isBot: false,
    },
    message: {
      id: "telegram:2",
      nativeId: "2",
      text: "hello",
      html: null,
      attachments: [],
      replyToMessageId: null,
      edited: false,
      languageHint: null,
    },
    capabilities: {
      history: "none",
      membership: "partial",
    },
    sourceMeta: {},
  };
}

describe("mapNormalizedEventToGatewayMessage", () => {
  test("maps a normalized event to a valid gateway message", () => {
    expect(mapNormalizedEventToGatewayMessage(createEvent())).toEqual({
      id: "telegram:2",
      groupId: "telegram:-100",
      groupName: "Ops",
      senderId: "telegram:1",
      senderName: "Alice",
      timestamp: "2026-03-28T12:00:00.000Z",
      text: "hello",
      caption: null,
      hasAttachment: false,
      attachmentKind: null,
      deliveryHint: "live",
    });
  });

  test("maps backfill to history_sync", () => {
    const message = mapNormalizedEventToGatewayMessage({
      ...createEvent(),
      delivery: {
        ...createEvent().delivery,
        isBackfill: true,
      },
    });

    expect(message.deliveryHint).toBe("history_sync");
  });

  test("maps attachments", () => {
    const message = mapNormalizedEventToGatewayMessage({
      ...createEvent(),
      message: {
        ...createEvent().message,
        attachments: [{ kind: "image", url: null, name: null, size: null }],
      },
    });

    expect(message.hasAttachment).toBe(true);
    expect(message.attachmentKind).toBe("image");
  });
});
