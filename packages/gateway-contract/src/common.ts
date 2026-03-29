import { z, type ZodTypeAny } from "zod";

export const UtcIsoDatetimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), "Expected a UTC ISO-8601 timestamp.");

export const GatewayHealthState = z.enum([
  "PAIRING_REQUIRED",
  "PAIRING",
  "CONNECTED",
  "BACKFILLING",
  "DEGRADED",
  "DISCONNECTED",
]);

export const GroupDiscoveryStatus = z.enum([
  "current",
  "from_sync",
  "waiting_for_traffic",
  "partial",
]);

export const CatalogCompleteness = z.enum([
  "observed_only",
  "history_sync_in_progress",
  "partial",
  "likely_complete",
  "unknown",
]);

export const SendDisposition = z.enum(["queued", "blocked"]);

export const RunnerPreference = z.enum(["auto", "demo", "codex", "claude"]);

export const MembershipGuardResult = z.enum([
  "passed",
  "blocked_target_contains_unknown_members",
  "blocked_empty_source_members",
  "blocked_empty_target_members",
  "blocked_gateway_unavailable",
]);

export const AttachmentKindSchema = z
  .enum(["image", "video", "audio", "document", "other"])
  .nullable();

export const DeliveryHintSchema = z.enum(["live", "history_sync", "unknown"]);

export const UrgencyDecisionSchema = z
  .object({
    urgent: z.boolean(),
    confidence: z.number().min(0).max(1),
    category: z.enum([
      "safety",
      "logistics",
      "schedule_change",
      "medical",
      "security",
      "other",
    ]),
    rationale: z.string().min(1).max(240),
    suggestedMessage: z.string().min(1).max(1000).nullable(),
  })
  .strict();

export const DigestDecisionSchema = z
  .object({
    shouldSend: z.boolean(),
    significanceScore: z.number().min(0).max(100),
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(4000),
    bullets: z.array(z.string().min(1).max(240)).max(12),
    rationale: z.string().min(1).max(240),
  })
  .strict();

export type UrgencyDecision = z.infer<typeof UrgencyDecisionSchema>;
export type DigestDecision = z.infer<typeof DigestDecisionSchema>;
export type GatewayHealthState = z.infer<typeof GatewayHealthState>;
export type GroupDiscoveryStatus = z.infer<typeof GroupDiscoveryStatus>;
export type CatalogCompleteness = z.infer<typeof CatalogCompleteness>;
export type SendDisposition = z.infer<typeof SendDisposition>;
export type RunnerPreference = z.infer<typeof RunnerPreference>;
export type MembershipGuardResult = z.infer<typeof MembershipGuardResult>;
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;
export type DeliveryHint = z.infer<typeof DeliveryHintSchema>;

export function parseOrThrow<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return schema.parse(input);
}

export function safeParseContract<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.SafeParseReturnType<unknown, z.infer<TSchema>> {
  return schema.safeParse(input);
}

export function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}
