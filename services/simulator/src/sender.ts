import { randomUUID } from "node:crypto";

import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { SimGroup, SimSender } from "./groups.js";

export function createSimulatedEvent(input: {
  group: SimGroup;
  sender: SimSender;
  text: string;
  timestampMs: number;
}): NormalizedEventEnvelope {
  const messageId = randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();
  const occurredAt = new Date(input.timestampMs).toISOString();
  const observedAt = new Date().toISOString();

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
      eventId: `${input.group.id}:${messageId}`,
      occurredAt,
      observedAt,
      isBackfill: false,
    },
    conversation: {
      id: input.group.id,
      nativeId: input.group.id,
      kind: "group",
      displayName: input.group.title,
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: input.sender.id,
      nativeId: input.sender.id,
      displayName: input.sender.name,
      handle: null,
      isBot: false,
    },
    message: {
      id: `${input.group.id}:${messageId}`,
      nativeId: messageId,
      text: input.text,
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
    sourceMeta: {
      hookSource: "event-bus",
    },
  };
}

export type IngestAckResponse = {
  ackVersion: "1.0";
  accepted: boolean;
  batchSize: number;
  storedCount: number;
  receipts: Array<{
    eventId: string;
    receivedAt: string;
    contentHash: string;
    byteLength: number;
    stored: boolean;
  }>;
};

export async function sendBatch(
  baseUrl: string,
  _token: string,
  events: NormalizedEventEnvelope[],
): Promise<IngestAckResponse> {
  const response = await fetch(new URL("/v2/ingest/events", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Simulator ingest failed: ${response.status} ${response.statusText} ${body}`);
  }

  return response.json() as Promise<IngestAckResponse>;
}
