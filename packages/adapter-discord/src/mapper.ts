import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { DiscordMessage, DiscordMessageDeleteEvent } from "./types.js";

type DiscordMapperEvent =
  | { type: "MESSAGE_CREATE"; data: DiscordMessage }
  | { type: "MESSAGE_UPDATE"; data: DiscordMessage }
  | { type: "MESSAGE_DELETE"; data: DiscordMessageDeleteEvent };

function resolveConversationKind(data: DiscordMessage | DiscordMessageDeleteEvent): "channel" | "group" {
  return data.guild_id ? "channel" : "group";
}

export function mapDiscordEventToEnvelope(
  event: DiscordMapperEvent,
  adapterVersion: string,
): NormalizedEventEnvelope | null {
  let eventType: "message.created" | "message.updated" | "message.deleted";
  let text: string | null = null;
  let actorId = "unknown";
  let handle: string | null = null;
  let displayName: string | null = null;
  let isBot = false;
  let occurredAt: string;

  if (event.type === "MESSAGE_CREATE") {
    eventType = "message.created";
    text = event.data.content ?? null;
    actorId = event.data.author?.id ?? "unknown";
    handle = event.data.author?.username ?? null;
    displayName = event.data.author?.global_name ?? event.data.author?.username ?? null;
    isBot = event.data.author?.bot ?? false;
    occurredAt = event.data.timestamp;
  } else if (event.type === "MESSAGE_UPDATE") {
    eventType = "message.updated";
    text = event.data.content ?? null;
    actorId = event.data.author?.id ?? "unknown";
    handle = event.data.author?.username ?? null;
    displayName = event.data.author?.global_name ?? event.data.author?.username ?? null;
    isBot = event.data.author?.bot ?? false;
    occurredAt = event.data.edited_timestamp ?? event.data.timestamp;
  } else {
    eventType = "message.deleted";
    occurredAt = new Date().toISOString();
  }

  if (text === null && eventType !== "message.deleted") {
    return null;
  }

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "discord",
      version: adapterVersion,
      officiality: "official",
    },
    delivery: {
      mode: "websocket",
      eventType,
      eventId: `discord:${event.type}:${event.data.id}`,
      occurredAt,
      observedAt: new Date().toISOString(),
      isBackfill: false,
    },
    conversation: {
      id: `discord:${event.data.channel_id}`,
      nativeId: event.data.channel_id,
      kind: resolveConversationKind(event.data),
      displayName: null,
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: `discord:${actorId}`,
      nativeId: actorId,
      displayName,
      handle,
      isBot,
    },
    message: {
      id: `discord:${event.data.id}`,
      nativeId: event.data.id,
      text,
      html: null,
      attachments: [],
      replyToMessageId: null,
      edited: eventType === "message.updated",
      languageHint: null,
    },
    capabilities: {
      history: "full",
      membership: "partial",
    },
    sourceMeta: {
      rawType: event.type,
      requiresMessageContentIntent: true,
    },
  };
}
