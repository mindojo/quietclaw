import { describe, expect, test } from "vitest";

import { LiveDaemonState } from "../../services/live-daemon/src/state";
import type { GatewayEnvelope } from "../../services/live-daemon/src/types";
import type { Clock } from "../../services/live-daemon/src/util/clock";

class TestClock implements Clock {
  constructor(private currentMs: number) {}

  now(): Date {
    return new Date(this.currentMs);
  }

  nowMs(): number {
    return this.currentMs;
  }

  nowIso(): string {
    return new Date(this.currentMs).toISOString();
  }

  set(ms: number): void {
    this.currentMs = ms;
  }
}

function createEnvelope(input: Partial<GatewayEnvelope["payload"]> & {
  chatId?: string;
  chatTitle?: string;
  eventId?: string;
  messageId?: string;
  timestampMs?: number;
  receivedAt?: string;
} = {}): GatewayEnvelope {
  const chatId = input.chatId ?? "grp_alpha";
  const messageId = input.messageId ?? "MSG_0001";
  const timestampMs = input.timestampMs ?? Date.now();

  return {
    receivedAt: input.receivedAt ?? new Date(timestampMs).toISOString(),
    source: "whatsapp-web",
    collectorVersion: "test-suite",
    eventType: "incoming-group-message",
    eventId: input.eventId ?? `${chatId}:${messageId}`,
    payload: {
      chatId,
      chatTitle: input.chatTitle ?? "Alpha Group",
      senderId: input.senderId ?? "sender_001@lid",
      senderName: input.senderName ?? "Sender One",
      messageId,
      timestampMs,
      text: input.text ?? "hello",
      caption: input.caption,
      rawKind: input.rawKind ?? "chat",
      attachments: input.attachments ?? [],
      metadata: input.metadata ?? {},
      observedAtMs: input.observedAtMs ?? timestampMs + 1_000,
      hookSource: input.hookSource ?? "event-bus",
    },
  };
}

describe("LiveDaemonState", () => {
  test("ingest creates a new group from an envelope", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    state.ingestEnvelope(createEnvelope({
      chatId: "grp_new",
      chatTitle: "New Group",
      timestampMs: clock.nowMs() - 60_000,
    }));

    const groups = state.getGroups();

    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0]).toMatchObject({
      id: "grp_new",
      name: "New Group",
      status: "current",
      isTargetEligible: true,
      memberCount: 1,
      messageCount24h: 1,
    });
  });

  test("ingest updates an existing group's lastMessageAt", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    state.ingestEnvelope(createEnvelope({
      chatId: "grp_same",
      chatTitle: "Same Group",
      messageId: "MSG_0001",
      timestampMs: clock.nowMs() - 10 * 60_000,
    }));
    state.ingestEnvelope(createEnvelope({
      chatId: "grp_same",
      chatTitle: "Same Group",
      messageId: "MSG_0002",
      timestampMs: clock.nowMs() - 60_000,
    }));

    const groups = state.getGroups();

    expect(groups.groups[0]?.lastMessageAt).toBe(
      new Date(clock.nowMs() - 60_000).toISOString(),
    );
  });

  test("groups are sorted by lastMessageAt descending", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    state.ingestEnvelope(createEnvelope({
      chatId: "grp_older",
      chatTitle: "Older Group",
      timestampMs: clock.nowMs() - 30 * 60_000,
    }));
    state.ingestEnvelope(createEnvelope({
      chatId: "grp_newer",
      chatTitle: "Newer Group",
      timestampMs: clock.nowMs() - 5 * 60_000,
      messageId: "MSG_0002",
    }));

    const groupIds = state.getGroups().groups.map((group) => group.id);

    expect(groupIds).toEqual(["grp_newer", "grp_older"]);
  });

  test("hideGroup excludes a group from getGroups", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    state.ingestEnvelope(createEnvelope({ chatId: "grp_visible", chatTitle: "Visible" }));
    state.ingestEnvelope(createEnvelope({
      chatId: "grp_hidden",
      chatTitle: "Hidden",
      messageId: "MSG_0002",
    }));

    state.hideGroup("grp_hidden");

    const groupIds = state.getGroups().groups.map((group) => group.id);

    expect(groupIds).toEqual(["grp_visible"]);
  });

  test("members accumulate from observed senders", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    state.ingestEnvelope(createEnvelope({
      chatId: "grp_members",
      senderId: "sender_001@lid",
      senderName: "Alice",
    }));
    state.ingestEnvelope(createEnvelope({
      chatId: "grp_members",
      senderId: "sender_002@lid",
      senderName: "Bob",
      messageId: "MSG_0002",
    }));

    const members = state.getGroupMembers("grp_members");

    expect(members?.members).toEqual([
      { id: "sender_001@lid", displayName: "Alice" },
      { id: "sender_002@lid", displayName: "Bob" },
    ]);
  });

  test("message pruning removes messages older than 24 hours", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    state.ingestEnvelope(createEnvelope({
      chatId: "grp_prune",
      messageId: "MSG_OLD",
      timestampMs: clock.nowMs() - 25 * 60 * 60 * 1000,
    }));
    state.ingestEnvelope(createEnvelope({
      chatId: "grp_prune",
      messageId: "MSG_RECENT",
      timestampMs: clock.nowMs() - 60 * 60 * 1000,
    }));

    const messages = state.getMessages({
      groupId: "grp_prune",
      since: new Date(clock.nowMs() - 26 * 60 * 60 * 1000).toISOString(),
      limit: 10,
      cursor: null,
    });

    expect(messages?.returnedCount).toBe(1);
    expect(messages?.messages.map((message) => message.id)).toEqual(["grp_prune:MSG_RECENT"]);
  });

  test("message storage is capped at 10000 entries", () => {
    const clock = new TestClock(Date.UTC(2026, 2, 25, 12, 0, 0));
    const state = new LiveDaemonState({ clock });

    for (let index = 0; index < 10_005; index += 1) {
      state.ingestEnvelope(createEnvelope({
        chatId: "grp_cap",
        messageId: `MSG_${String(index).padStart(5, "0")}`,
        timestampMs: clock.nowMs() - (10_005 - index) * 1_000,
      }));
    }

    const messages = state.getMessages({
      groupId: "grp_cap",
      since: new Date(clock.nowMs() - 4 * 60 * 60 * 1000).toISOString(),
      limit: 11_000,
      cursor: null,
    });

    expect(messages?.returnedCount).toBe(10_000);
    expect(messages?.messages[0]?.id).toBe("grp_cap:MSG_00005");
    expect(messages?.messages.at(-1)?.id).toBe("grp_cap:MSG_10004");
  });
});
