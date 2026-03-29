import {
  GatewayMessageSchema,
  type AttachmentKind,
  type GatewayMessage,
} from "@quietclaw/gateway-contract";
import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

function mapAttachmentKind(rawKind: string | undefined): AttachmentKind {
  switch (rawKind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "document":
      return "document";
    case undefined:
      return null;
    default:
      return "other";
  }
}

export function mapNormalizedEventToGatewayMessage(
  event: NormalizedEventEnvelope,
): GatewayMessage {
  const firstAttachment = event.message.attachments[0];
  const attachmentKind = mapAttachmentKind(firstAttachment?.kind);
  const hasAttachment = event.message.attachments.length > 0;
  const meta =
    event.message.edited || event.message.replyToMessageId !== null
      ? {
          ...(event.message.edited ? { isEdited: true } : {}),
          ...(event.message.replyToMessageId !== null
            ? { quotedMessageId: event.message.replyToMessageId }
            : {}),
        }
      : undefined;

  return GatewayMessageSchema.parse({
    id: event.message.id,
    groupId: event.conversation.id,
    groupName: event.conversation.displayName ?? event.conversation.nativeId,
    senderId: event.actor.id,
    senderName: event.actor.displayName,
    timestamp: event.delivery.occurredAt,
    text: event.message.text,
    caption: null,
    hasAttachment,
    attachmentKind,
    deliveryHint: event.delivery.isBackfill ? "history_sync" : "live",
    ...(meta ? { meta } : {}),
  });
}
