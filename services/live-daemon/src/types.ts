import { z } from "zod";

export const AttachmentMetaSchema = z
  .object({
    kind: z.enum(["image", "video", "document", "audio", "sticker", "gif", "unknown"]),
    mimetype: z.string().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    durationSec: z.number().optional(),
    pageCount: z.number().optional(),
    caption: z.string().optional(),
    thumbnailPresent: z.boolean().optional(),
    directPathPresent: z.boolean().optional(),
    mediaKeyPresent: z.boolean().optional(),
  })
  .passthrough();

export const GatewayEnvelopePayloadSchema = z
  .object({
    chatId: z.string(),
    chatTitle: z.string().optional(),
    senderId: z.string().optional(),
    senderName: z.string().optional(),
    messageId: z.string(),
    timestampMs: z.number(),
    text: z.string().optional(),
    caption: z.string().optional(),
    rawKind: z.string().optional(),
    attachments: z.array(AttachmentMetaSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
    observedAtMs: z.number(),
    hookSource: z.string().optional(),
  })
  .passthrough();

export const GatewayEnvelopeSchema = z
  .object({
    receivedAt: z.string().optional(),
    source: z.literal("whatsapp-web"),
    collectorVersion: z.string(),
    eventType: z.literal("incoming-group-message"),
    eventId: z.string(),
    payload: GatewayEnvelopePayloadSchema,
  })
  .strip();

export type AttachmentMeta = z.infer<typeof AttachmentMetaSchema>;
export type GatewayEnvelopePayload = z.infer<typeof GatewayEnvelopePayloadSchema>;
export type GatewayEnvelope = z.infer<typeof GatewayEnvelopeSchema>;
