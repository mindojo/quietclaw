import { z } from "zod";

export const OfficialitySchema = z.enum([
  "official",
  "open_protocol",
  "community",
  "experimental",
]);

export const ConversationKindSchema = z.enum([
  "dm",
  "group",
  "channel",
  "space",
  "room",
  "unknown",
]);

export const DeliveryModeSchema = z.enum([
  "webhook",
  "poll",
  "websocket",
  "bridge",
  "manual_import",
  "simulated",
]);

export const CapabilityLevelSchema = z.enum([
  "none",
  "partial",
  "full",
  "unknown",
]);

export const IngestEventTypeSchema = z.enum([
  "message.created",
  "message.updated",
  "message.deleted",
  "conversation.upserted",
  "membership.snapshot",
  "sync.started",
  "sync.progress",
  "sync.completed",
  "health.updated",
]);

export type Officiality = z.infer<typeof OfficialitySchema>;
export type ConversationKind = z.infer<typeof ConversationKindSchema>;
export type DeliveryMode = z.infer<typeof DeliveryModeSchema>;
export type CapabilityLevel = z.infer<typeof CapabilityLevelSchema>;
export type IngestEventType = z.infer<typeof IngestEventTypeSchema>;
