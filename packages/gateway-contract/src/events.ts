import { z } from "zod";

import { GroupDiscoveryStatus, SendDisposition, UtcIsoDatetimeSchema } from "./common.js";
import { GroupsResponseSchema } from "./groups.js";
import { GatewayHealthResponseSchema } from "./health.js";
import { GatewayMessageSchema } from "./messages.js";

export const EventTypeSchema = z.enum([
  "heartbeat",
  "health.updated",
  "group.catalog.updated",
  "message.received",
  "send.ack",
]);

export const EventEnvelopeSchema = z
  .object({
    type: z.string(),
    emittedAt: UtcIsoDatetimeSchema,
    payload: z.unknown(),
  })
  .strict();

export const HeartbeatEventPayloadSchema = z
  .object({
    unixMs: z.number().int(),
  })
  .strict();

export const HealthUpdatedEventPayloadSchema = GatewayHealthResponseSchema;

export const GroupCatalogUpdatedPayloadSchema = GroupsResponseSchema;

export const MessageReceivedEventPayloadSchema = GatewayMessageSchema.extend({
  live: z.boolean(),
  groupStatus: GroupDiscoveryStatus,
}).strict();

export const SendAckEventPayloadSchema = z
  .object({
    requestId: z.string(),
    gatewayMessageId: z.string().nullable(),
    disposition: SendDisposition,
    detail: z.string(),
  })
  .strict();

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type HeartbeatEventPayload = z.infer<typeof HeartbeatEventPayloadSchema>;
export type HealthUpdatedEventPayload = z.infer<typeof HealthUpdatedEventPayloadSchema>;
export type GroupCatalogUpdatedPayload = z.infer<typeof GroupCatalogUpdatedPayloadSchema>;
export type MessageReceivedEventPayload = z.infer<typeof MessageReceivedEventPayloadSchema>;
export type SendAckEventPayload = z.infer<typeof SendAckEventPayloadSchema>;
