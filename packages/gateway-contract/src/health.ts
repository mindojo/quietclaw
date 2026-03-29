import { z } from "zod";

import {
  CatalogCompleteness,
  GatewayHealthState,
  UtcIsoDatetimeSchema,
} from "./common.js";

export const GatewayHealthResponseSchema = z
  .object({
    state: GatewayHealthState,
    connected: z.boolean(),
    pairingRequired: z.boolean(),
    backfilling: z.boolean(),
    since: UtcIsoDatetimeSchema,
    detail: z.string(),
    qrAvailable: z.boolean(),
    observedGroupCount: z.number().int().nonnegative(),
    catalogCompleteness: CatalogCompleteness,
    warnings: z.array(z.string()),
  })
  .strict();

export const PairQrResponseSchema = z
  .object({
    available: z.boolean(),
    expiresAt: UtcIsoDatetimeSchema.nullable(),
    dataUrlPng: z.string().nullable(),
    detail: z.string(),
  })
  .strict();

export type GatewayHealthResponse = z.infer<typeof GatewayHealthResponseSchema>;
export type PairQrResponse = z.infer<typeof PairQrResponseSchema>;
