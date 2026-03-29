import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { ZulipEvent } from "./types.js";

export function mapZulipEventToEnvelope(
  event: ZulipEvent,
  adapterVersion: string,
): NormalizedEventEnvelope | null {
  let eventType: "message.created" | "message.updated" | "message.deleted";
  let conversationId: number | undefined;
  let displayName: string | null = null;
  let threadId: string | null = null;
  let actorNativeId = "unknown";
  let handle: string | null = null;
  let displayActorName: string | null = null;
  let isBot = false;
  let messageNativeId: string;
  let text: string | null = null;
  let occurredAt: string;

  if (event.type === "message") {
    eventType = "message.created";
    conversationId = event.message.stream_id;
    displayName = event.message.stream_name ?? null;
    threadId = event.message.topic ? `zulip:${event.message.stream_id ?? "unknown"}:${event.message.topic}` : null;
    actorNativeId = String(event.message.sender_id);
    handle = event.message.sender_email ?? null;
    displayActorName = event.message.sender_full_name ?? event.message.sender_short_name ?? null;
    isBot = event.message.sender_is_bot ?? false;
    messageNativeId = String(event.message.id);
    text = event.message.content ?? null;
    occurredAt = new Date(event.message.timestamp * 1000).toISOString();
  } else if (event.type === "update_message") {
    eventType = "message.updated";
    conversationId = event.stream_id;
    displayName = event.stream_name ?? null;
    threadId = event.topic ? `zulip:${event.stream_id ?? "unknown"}:${event.topic}` : null;
    actorNativeId = String(event.sender_id ?? "unknown");
    handle = event.sender_email ?? null;
    displayActorName = event.sender_full_name ?? null;
    messageNativeId = String(event.message_id);
    text = event.content ?? event.rendered_content ?? null;
    occurredAt = new Date(event.edit_timestamp * 1000).toISOString();
  } else {
    eventType = "message.deleted";
    conversationId = event.stream_id;
    displayName = event.stream_name ?? null;
    threadId = event.topic ? `zulip:${event.stream_id ?? "unknown"}:${event.topic}` : null;
    messageNativeId = String(event.message_id);
    occurredAt = new Date().toISOString();
  }

  if (conversationId === undefined) {
    return null;
  }

  if (text === null && eventType !== "message.deleted") {
    return null;
  }

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "zulip",
      version: adapterVersion,
      officiality: "open_protocol",
    },
    delivery: {
      mode: "poll",
      eventType,
      eventId: `zulip:${event.type}:${messageNativeId}`,
      occurredAt,
      observedAt: new Date().toISOString(),
      isBackfill: false,
    },
    conversation: {
      id: `zulip:${conversationId}`,
      nativeId: String(conversationId),
      kind: "channel",
      displayName,
      tenantId: null,
      threadId,
    },
    actor: {
      id: `zulip:${actorNativeId}`,
      nativeId: actorNativeId,
      displayName: displayActorName,
      handle,
      isBot,
    },
    message: {
      id: `zulip:${messageNativeId}`,
      nativeId: messageNativeId,
      text,
      html: null,
      attachments: [],
      replyToMessageId: null,
      edited: eventType === "message.updated",
      languageHint: null,
    },
    capabilities: {
      history: "full",
      membership: "none",
    },
    sourceMeta: {
      rawType: event.type,
    },
  };
}
