import { z } from "zod";

import {
  CapabilityLevelSchema,
  ConversationKindSchema,
  DeliveryModeSchema,
  IngestEventTypeSchema,
  OfficialitySchema,
} from "./enums.js";

export const NormalizedEventEnvelopeSchema = z.object({
  schemaVersion: z.literal("1.0"),
  adapter: z.object({
    id: z.string(),
    version: z.string(),
    officiality: OfficialitySchema,
  }),
  delivery: z.object({
    mode: DeliveryModeSchema,
    eventType: IngestEventTypeSchema,
    eventId: z.string(),
    occurredAt: z.string(),
    observedAt: z.string(),
    isBackfill: z.boolean(),
  }),
  conversation: z.object({
    id: z.string(),
    nativeId: z.string(),
    kind: ConversationKindSchema,
    displayName: z.string().nullable(),
    tenantId: z.string().nullable(),
    threadId: z.string().nullable(),
  }),
  actor: z.object({
    id: z.string(),
    nativeId: z.string(),
    displayName: z.string().nullable(),
    handle: z.string().nullable(),
    isBot: z.boolean(),
  }),
  message: z.object({
    id: z.string(),
    nativeId: z.string(),
    text: z.string().nullable(),
    html: z.string().nullable(),
    attachments: z.array(z.object({
      kind: z.string(),
      url: z.string().nullable(),
      name: z.string().nullable(),
      size: z.number().nullable(),
    })).default([]),
    replyToMessageId: z.string().nullable(),
    edited: z.boolean(),
    languageHint: z.string().nullable(),
  }),
  capabilities: z.object({
    history: CapabilityLevelSchema,
    membership: CapabilityLevelSchema,
  }),
  sourceMeta: z.record(z.string(), z.unknown()).default({}),
});

export type NormalizedEventEnvelope = z.infer<typeof NormalizedEventEnvelopeSchema>;
