import { randomUUID } from "node:crypto";

import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { ScenarioEvent } from "./types.js";

export function scenarioEventToEnvelope(event: ScenarioEvent): NormalizedEventEnvelope {
  return scenarioEventToEnvelopeWithOffset(event, 0);
}

function scenarioEventToEnvelopeWithOffset(
  event: ScenarioEvent,
  offsetMs: number,
): NormalizedEventEnvelope {
  const messageId = randomUUID();
  const eventTimeMs = new Date(event.at).getTime() + offsetMs;
  const occurredAt = new Date(eventTimeMs).toISOString();

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "harness",
      version: "1.0.0",
      officiality: "experimental",
    },
    delivery: {
      mode: "simulated",
      eventType: "message.created",
      eventId: `${event.conversation_id}:${randomUUID()}`,
      occurredAt,
      observedAt: new Date(
        event.mode === "live"
          ? eventTimeMs
          : eventTimeMs + 10 * 60 * 1000,
      ).toISOString(),
      isBackfill: event.mode === "backfill",
    },
    conversation: {
      id: event.conversation_id,
      nativeId: event.conversation_id,
      kind: "group",
      displayName: event.conversation_title,
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: event.sender_id,
      nativeId: event.sender_id,
      displayName: event.sender_name,
      handle: null,
      isBot: false,
    },
    message: {
      id: `${event.conversation_id}:${messageId}`,
      nativeId: messageId,
      text: event.text,
      html: null,
      attachments: [],
      replyToMessageId: null,
      edited: false,
      languageHint: null,
    },
    capabilities: {
      history: event.mode === "backfill" ? "partial" : "none",
      membership: "partial",
    },
    sourceMeta: {
      hookSource: "harness",
    },
  };
}

export function scenarioToEnvelopes(events: ScenarioEvent[]): NormalizedEventEnvelope[] {
  if (events.length === 0) {
    return [];
  }

  const latestEventMs = Math.max(...events.map((event) => new Date(event.at).getTime()));
  const targetLatestMs = Date.now() - 60 * 60 * 1000;
  const offsetMs = targetLatestMs - latestEventMs;

  return events.map((event) => scenarioEventToEnvelopeWithOffset(event, offsetMs));
}
