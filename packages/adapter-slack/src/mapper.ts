import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { SlackConversation, SlackMessageEvent } from "./types.js";

type SlackMapperOptions = {
  channel?: SlackConversation;
};

function resolveSlackConversationKind(channel: SlackConversation | undefined, channelType: SlackMessageEvent["channel_type"]): "channel" | "group" {
  if (channel?.is_private || channel?.is_group || channel?.is_mpim || channelType === "group" || channelType === "mpim") {
    return "group";
  }

  return "channel";
}

function resolveSlackActorId(event: SlackMessageEvent): string {
  if (event.subtype === "message_deleted") {
    return event.previous_message?.user ?? event.user ?? "unknown";
  }

  if (event.subtype === "message_changed") {
    return event.message?.user ?? event.previous_message?.user ?? event.user ?? "unknown";
  }

  return event.user ?? "unknown";
}

function resolveSlackText(event: SlackMessageEvent): string | null {
  if (event.subtype === "message_deleted") {
    return null;
  }

  if (event.subtype === "message_changed") {
    return event.message?.text ?? null;
  }

  return event.text ?? null;
}

export function mapSlackEventToEnvelope(
  event: SlackMessageEvent,
  adapterVersion: string,
  options: SlackMapperOptions = {},
): NormalizedEventEnvelope | null {
  let eventType: "message.created" | "message.updated" | "message.deleted";
  let rawType = event.type;
  let nativeMessageId = event.ts;
  let occurredAt = new Date(Number(event.ts) * 1000).toISOString();

  if (event.subtype === "message_changed") {
    eventType = "message.updated";
    rawType = "message_changed";
    nativeMessageId = event.message?.ts ?? event.ts;
    occurredAt = new Date(Number(event.message?.edited?.ts ?? nativeMessageId) * 1000).toISOString();
  } else if (event.subtype === "message_deleted") {
    eventType = "message.deleted";
    rawType = "message_deleted";
    nativeMessageId = event.deleted_ts ?? event.previous_message?.ts ?? event.ts;
    occurredAt = new Date(Number(nativeMessageId) * 1000).toISOString();
  } else {
    eventType = "message.created";
  }

  const text = resolveSlackText(event);
  if (text === null && eventType !== "message.deleted") {
    return null;
  }

  const actorNativeId = resolveSlackActorId(event);

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "slack",
      version: adapterVersion,
      officiality: "official",
    },
    delivery: {
      mode: "websocket",
      eventType,
      eventId: `slack:${rawType}:${event.channel}:${nativeMessageId}`,
      occurredAt,
      observedAt: new Date().toISOString(),
      isBackfill: false,
    },
    conversation: {
      id: `slack:${event.channel}`,
      nativeId: event.channel,
      kind: resolveSlackConversationKind(options.channel, event.channel_type),
      displayName: options.channel?.name ?? null,
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: `slack:${actorNativeId}`,
      nativeId: actorNativeId,
      displayName: null,
      handle: event.user ?? event.message?.user ?? null,
      isBot: Boolean(event.subtype?.startsWith("bot_")),
    },
    message: {
      id: `slack:${nativeMessageId}`,
      nativeId: nativeMessageId,
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
      rawType,
      subtype: event.subtype ?? null,
      hidden: event.hidden ?? false,
    },
  };
}
