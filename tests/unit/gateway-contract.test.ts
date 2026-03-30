import { describe, expect, test } from "vitest";

import {
  EventEnvelopeSchema,
  GroupCatalogUpdatedPayloadSchema,
  GroupsResponseSchema,
  MessageReceivedEventPayloadSchema,
  UtcIsoDatetimeSchema,
  buildAuthHeaders,
  safeParseContract,
} from "../../packages/gateway-contract/src/index.js";

describe("gateway contract", () => {
  test("accepts a valid groups response", () => {
    const parsed = GroupsResponseSchema.parse({
      catalogCompleteness: "partial",
      gatewayState: "CONNECTED",
      groups: [
        {
          id: "group-1",
          name: "Ops",
          status: "current",
          lastMessageAt: "2026-03-28T10:00:00.000Z",
          messageCount24h: 3,
          memberCount: 12,
          isTargetEligible: true,
          notes: [],
        },
      ],
      notices: ["Partial discovery in effect."],
    });

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]?.name).toBe("Ops");
  });

  test("rejects non-UTC timestamps", () => {
    const result = UtcIsoDatetimeSchema.safeParse("2026-03-28T10:00:00+01:00");

    expect(result.success).toBe(false);
  });

  test("builds strict event payloads for live messages", () => {
    const parsed = MessageReceivedEventPayloadSchema.parse({
      id: "msg-1",
      groupId: "group-1",
      groupName: "Ops",
      senderId: "user-1",
      senderName: "Alice",
      timestamp: "2026-03-28T10:00:00.000Z",
      text: "Need eyes on this now",
      caption: null,
      hasAttachment: false,
      attachmentKind: null,
      deliveryHint: "live",
      live: true,
      groupStatus: "current",
      meta: {
        isEdited: false,
        quotedMessageId: null,
      },
    });

    expect(parsed.live).toBe(true);
    expect(parsed.deliveryHint).toBe("live");
  });

  test("keeps event envelopes and payload schemas compatible", () => {
    const payload = GroupCatalogUpdatedPayloadSchema.parse({
      catalogCompleteness: "likely_complete",
      gatewayState: "CONNECTED",
      groups: [],
      notices: [],
    });

    const envelope = EventEnvelopeSchema.parse({
      type: "group.catalog.updated",
      emittedAt: "2026-03-28T10:00:00.000Z",
      payload,
    });

    expect(envelope.payload).toEqual(payload);
  });

  test("returns auth headers and safe parse failures predictably", () => {
    expect(buildAuthHeaders("secret-token")).toEqual({
      Authorization: "Bearer secret-token",
    });

    const result = safeParseContract(GroupsResponseSchema, {
      catalogCompleteness: "partial",
      gatewayState: "CONNECTED",
      groups: [],
    });

    expect(result.success).toBe(false);
  });
});
