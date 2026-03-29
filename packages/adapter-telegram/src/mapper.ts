import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { TelegramMessage, TelegramUpdate, TelegramUser } from "./types.js";

function resolveMessageCandidate(
  update: TelegramUpdate,
): { rawType: string; eventType: "message.created" | "message.updated"; message: TelegramMessage } | null {
  if (update.message) {
    return { rawType: "message", eventType: "message.created", message: update.message };
  }
  if (update.edited_message) {
    return { rawType: "edited_message", eventType: "message.updated", message: update.edited_message };
  }
  if (update.channel_post) {
    return { rawType: "channel_post", eventType: "message.created", message: update.channel_post };
  }
  if (update.edited_channel_post) {
    return { rawType: "edited_channel_post", eventType: "message.updated", message: update.edited_channel_post };
  }
  return null;
}

function resolveConversationKind(chatType: TelegramMessage["chat"]["type"]): "dm" | "group" | "channel" {
  switch (chatType) {
    case "private":
      return "dm";
    case "channel":
      return "channel";
    case "group":
    case "supergroup":
      return "group";
  }
}

function resolveActorDisplayName(user: TelegramUser | undefined): string | null {
  if (!user) {
    return null;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName.length > 0) {
    return fullName;
  }

  return user.username ?? null;
}

function resolveAttachments(message: TelegramMessage): Array<{
  kind: string;
  url: string | null;
  name: string | null;
  size: number | null;
}> {
  if (message.photo && message.photo.length > 0) {
    return [{ kind: "image", url: null, name: null, size: null }];
  }
  if (message.video) {
    return [{ kind: "video", url: null, name: null, size: null }];
  }
  if (message.document) {
    return [{ kind: "document", url: null, name: null, size: null }];
  }
  if (message.audio) {
    return [{ kind: "audio", url: null, name: null, size: null }];
  }
  return [];
}

export function mapTelegramUpdateToEvent(
  update: TelegramUpdate,
  adapterVersion: string,
): NormalizedEventEnvelope | null {
  const candidate = resolveMessageCandidate(update);
  if (candidate === null) {
    return null;
  }

  const { message, eventType, rawType } = candidate;
  const actor = message.from;
  const occurredAt = new Date((message.edit_date ?? message.date) * 1000).toISOString();

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "telegram",
      version: adapterVersion,
      officiality: "official",
    },
    delivery: {
      mode: "poll",
      eventType,
      eventId: `telegram:update:${update.update_id}`,
      occurredAt,
      observedAt: new Date().toISOString(),
      isBackfill: false,
    },
    conversation: {
      id: `telegram:${message.chat.id}`,
      nativeId: String(message.chat.id),
      kind: resolveConversationKind(message.chat.type),
      displayName: message.chat.title ?? null,
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: `telegram:${actor?.id ?? 0}`,
      nativeId: String(actor?.id ?? 0),
      displayName: resolveActorDisplayName(actor),
      handle: actor?.username ?? null,
      isBot: actor?.is_bot ?? false,
    },
    message: {
      id: `telegram:${message.message_id}`,
      nativeId: String(message.message_id),
      text: message.text ?? message.caption ?? null,
      html: null,
      attachments: resolveAttachments(message),
      replyToMessageId: message.reply_to_message ? `telegram:${message.reply_to_message.message_id}` : null,
      edited: eventType === "message.updated" ? Boolean(message.edit_date) : false,
      languageHint: null,
    },
    capabilities: {
      history: "none",
      membership: "partial",
    },
    sourceMeta: {
      rawType,
      updateId: update.update_id,
      chatType: message.chat.type,
    },
  };
}
