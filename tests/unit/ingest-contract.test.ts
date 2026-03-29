import { describe, expect, test } from "vitest";

import {
  IngestEventTypeSchema,
  NormalizedEventEnvelopeSchema,
  type NormalizedEventEnvelope,
} from "../../packages/ingest-contract/src/index.js";

function createEvent(): NormalizedEventEnvelope {
  return {
    schemaVersion: "1.0",
    adapter: {
      id: "simulator",
      version: "1.0.0",
      officiality: "experimental",
    },
    delivery: {
      mode: "simulated",
      eventType: "message.created",
      eventId: "evt-1",
      occurredAt: "2026-03-28T10:00:00.000Z",
      observedAt: "2026-03-28T10:00:01.000Z",
      isBackfill: false,
    },
    conversation: {
      id: "group-1",
      nativeId: "group-1",
      kind: "group",
      displayName: "Group 1",
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: "user-1",
      nativeId: "user-1",
      displayName: "Alice",
      handle: null,
      isBot: false,
    },
    message: {
      id: "msg-1",
      nativeId: "msg-1",
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

describe("NormalizedEventEnvelopeSchema", () => {
  test("accepts a valid normalized event", () => {
    expect(NormalizedEventEnvelopeSchema.parse(createEvent())).toMatchObject({
      schemaVersion: "1.0",
    });
  });

  test("rejects missing required fields", () => {
    const invalid = createEvent();
    delete (invalid as { actor?: unknown }).actor;

    expect(NormalizedEventEnvelopeSchema.safeParse(invalid).success).toBe(false);
  });

  test("accepts all ingest event types", () => {
    for (const eventType of IngestEventTypeSchema.options) {
      const parsed = NormalizedEventEnvelopeSchema.parse({
        ...createEvent(),
        delivery: {
          ...createEvent().delivery,
          eventType,
        },
      });
      expect(parsed.delivery.eventType).toBe(eventType);
    }
  });

  test("allows sourceMeta to be omitted", () => {
    const event = createEvent();
    delete (event as { sourceMeta?: unknown }).sourceMeta;

    const parsed = NormalizedEventEnvelopeSchema.parse(event);
    expect(parsed.sourceMeta).toEqual({});
  });
});
