import {
  GatewayMessageSchema,
  type AttachmentKind,
  type DeliveryHint,
  type GatewayMessage,
} from "@quietclaw/gateway-contract";

import type {
  AttachmentMeta,
  GatewayEnvelope,
  GatewayEnvelopePayload,
} from "./types.js";

const HISTORY_SYNC_THRESHOLD_MS = 5 * 60_000;

function resolveSenderId(payload: GatewayEnvelopePayload): string {
  if (payload.senderId && payload.senderId.trim().length > 0) {
    return payload.senderId;
  }

  if (payload.senderName && payload.senderName.trim().length > 0) {
    return `unknown:${payload.senderName.trim().toLowerCase()}`;
  }

  return `unknown:${payload.messageId}`;
}

function mapAttachmentKindFromMeta(attachment: AttachmentMeta | undefined): AttachmentKind {
  switch (attachment?.kind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "document":
      return "document";
    case "sticker":
    case "gif":
    case "unknown":
      return "other";
    default:
      return null;
  }
}

function mapAttachmentKindFromRawKind(rawKind: string | undefined): AttachmentKind {
  switch (rawKind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "document":
      return "document";
    case "chat":
    case undefined:
      return null;
    default:
      return "other";
  }
}

export function resolveGroupName(payload: GatewayEnvelopePayload): string {
  const title = payload.chatTitle?.trim();
  return title && title.length > 0 ? title : payload.chatId;
}

export function resolveDeliveryHint(payload: GatewayEnvelopePayload): DeliveryHint {
  const lagMs = payload.observedAtMs - payload.timestampMs;

  if (Number.isFinite(lagMs) && lagMs >= HISTORY_SYNC_THRESHOLD_MS) {
    return "history_sync";
  }

  return "live";
}

export function mapEnvelopeToGatewayMessage(envelope: GatewayEnvelope): GatewayMessage {
  const { payload } = envelope;
  const attachmentKind = payload.attachments.length > 0
    ? mapAttachmentKindFromMeta(payload.attachments[0])
    : mapAttachmentKindFromRawKind(payload.rawKind);
  const quotedMessageId =
    typeof payload.metadata.quotedMessageId === "string"
      ? payload.metadata.quotedMessageId
      : null;
  const isEdited =
    typeof payload.metadata.isEdited === "boolean" ? payload.metadata.isEdited : undefined;
  const meta =
    typeof isEdited === "boolean" || quotedMessageId !== null
      ? {
          ...(typeof isEdited === "boolean" ? { isEdited } : {}),
          quotedMessageId,
        }
      : undefined;

  return GatewayMessageSchema.parse({
    id: envelope.eventId,
    groupId: payload.chatId,
    groupName: resolveGroupName(payload),
    senderId: resolveSenderId(payload),
    senderName: payload.senderName ?? null,
    timestamp: new Date(payload.timestampMs).toISOString(),
    text: payload.text ?? null,
    caption: payload.caption ?? null,
    hasAttachment: attachmentKind !== null,
    attachmentKind,
    deliveryHint: resolveDeliveryHint(payload),
    ...(meta ? { meta } : {}),
  });
}

export function resolveObservedMember(payload: GatewayEnvelopePayload) {
  return {
    id: resolveSenderId(payload),
    displayName: payload.senderName ?? null,
  };
}
