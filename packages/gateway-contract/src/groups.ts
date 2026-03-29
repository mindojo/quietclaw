import { z } from "zod";

import {
  CatalogCompleteness,
  GatewayHealthState,
  GroupDiscoveryStatus,
  UtcIsoDatetimeSchema,
} from "./common.js";

export const GatewayGroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: GroupDiscoveryStatus,
    lastMessageAt: UtcIsoDatetimeSchema.nullable(),
    messageCount24h: z.number().int().nonnegative(),
    memberCount: z.number().int().nonnegative().nullable(),
    isTargetEligible: z.boolean(),
    notes: z.array(z.string()),
  })
  .strict();

export const GroupsResponseSchema = z
  .object({
    catalogCompleteness: CatalogCompleteness,
    gatewayState: GatewayHealthState,
    groups: z.array(GatewayGroupSchema),
    notices: z.array(z.string()),
  })
  .strict();

export type GatewayGroup = z.infer<typeof GatewayGroupSchema>;
export type GroupsResponse = z.infer<typeof GroupsResponseSchema>;
