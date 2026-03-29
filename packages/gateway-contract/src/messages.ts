import { z } from "zod";

import {
  AttachmentKindSchema,
  DeliveryHintSchema,
  UtcIsoDatetimeSchema,
} from "./common.js";

export const GatewayMessageSchema = z
  .object({
    id: z.string(),
    groupId: z.string(),
    groupName: z.string(),
    senderId: z.string(),
    senderName: z.string().nullable(),
    timestamp: UtcIsoDatetimeSchema,
    text: z.string().nullable(),
    caption: z.string().nullable(),
    hasAttachment: z.boolean(),
    attachmentKind: AttachmentKindSchema,
    deliveryHint: DeliveryHintSchema,
    meta: z
      .object({
        isEdited: z.boolean().optional(),
        quotedMessageId: z.string().nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const GroupMessagesResponseSchema = z
  .object({
    groupId: z.string(),
    groupName: z.string(),
    since: UtcIsoDatetimeSchema,
    returnedCount: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    complete: z.boolean(),
    messages: z.array(GatewayMessageSchema),
    notes: z.array(z.string()),
  })
  .strict();

export type GatewayMessage = z.infer<typeof GatewayMessageSchema>;
export type GroupMessagesResponse = z.infer<typeof GroupMessagesResponseSchema>;
