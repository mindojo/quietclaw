import { z } from "zod";

import { SendDisposition, UtcIsoDatetimeSchema } from "./common.js";

export const SendMessageRequestSchema = z
  .object({
    requestId: z.string(),
    targetGroupId: z.string(),
    text: z.string().min(1).max(12000),
    reason: z.enum(["urgent", "digest", "manual_test"]),
    clientTimestamp: UtcIsoDatetimeSchema,
  })
  .strict();

export const SendMessageResponseSchema = z
  .object({
    disposition: SendDisposition,
    requestId: z.string(),
    gatewayMessageId: z.string().nullable(),
    detail: z.string(),
    blockedReason: z.string().nullable(),
  })
  .strict();

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;
