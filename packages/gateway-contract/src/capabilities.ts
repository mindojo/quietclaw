import { z } from "zod";

export const CapabilitiesResponseSchema = z
  .object({
    apiVersion: z.literal("1.0"),
    providerId: z.string(),
    providerVersion: z.string(),
    features: z
      .object({
        qrPairing: z.boolean(),
        historySync: z.boolean(),
        groupMembershipSnapshots: z.boolean(),
        messageSend: z.boolean(),
        demoControls: z.boolean(),
      })
      .strict(),
    retentionHoursMax: z.number().int().positive(),
    auth: z
      .object({
        scheme: z.literal("Bearer"),
        tokenRotationSupported: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type CapabilitiesResponse = z.infer<typeof CapabilitiesResponseSchema>;
