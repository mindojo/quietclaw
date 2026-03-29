import { z } from "zod";

import { UtcIsoDatetimeSchema } from "./common.js";

export const GroupMemberSchema = z
  .object({
    id: z.string(),
    displayName: z.string().nullable(),
  })
  .strict();

export const GroupMembersResponseSchema = z
  .object({
    groupId: z.string(),
    groupName: z.string(),
    members: z.array(GroupMemberSchema),
    snapshotAt: UtcIsoDatetimeSchema,
    reliable: z.boolean(),
    notes: z.array(z.string()),
  })
  .strict();

export type GroupMember = z.infer<typeof GroupMemberSchema>;
export type GroupMembersResponse = z.infer<typeof GroupMembersResponseSchema>;
