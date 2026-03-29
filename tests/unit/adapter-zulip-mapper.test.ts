import { describe, expect, test } from "vitest";

import { mapZulipEventToEnvelope } from "../../packages/adapter-zulip/src/mapper.js";
import type { ZulipEvent } from "../../packages/adapter-zulip/src/types.js";

function createMessageEvent(overrides: Partial<Extract<ZulipEvent, { type: "message" }>> = {}): Extract<ZulipEvent, { type: "message" }> {
  return {
    type: "message",
    message: {
      id: 10,
      stream_id: 20,
      stream_name: "engineering",
      topic: "deploys",
      sender_id: 30,
      sender_email: "alice@example.com",
      sender_full_name: "Alice Example",
      sender_is_bot: false,
      content: "hello zulip",
      timestamp: 1_700_000_000,
    },
    ...overrides,
  };
}

describe("mapZulipEventToEnvelope", () => {
  test("maps a basic message to message.created", () => {
    const event = mapZulipEventToEnvelope(createMessageEvent(), "1.2.3");

    expect(event).toMatchObject({
      adapter: { id: "zulip", version: "1.2.3", officiality: "open_protocol" },
      delivery: { mode: "poll", eventType: "message.created" },
      conversation: { id: "zulip:20", kind: "channel", displayName: "engineering", threadId: "zulip:20:deploys" },
      message: { id: "zulip:10", text: "hello zulip", edited: false },
    });
  });

  test("maps an edited message to message.updated", () => {
    const event = mapZulipEventToEnvelope({
      type: "update_message",
      message_id: 10,
      stream_id: 20,
      stream_name: "engineering",
      topic: "deploys",
      sender_id: 30,
      sender_email: "alice@example.com",
      sender_full_name: "Alice Example",
      content: "edited zulip",
      edit_timestamp: 1_700_000_100,
    }, "1.2.3");

    expect(event?.delivery.eventType).toBe("message.updated");
    expect(event?.message.text).toBe("edited zulip");
    expect(event?.message.edited).toBe(true);
  });

  test("maps a deleted message to message.deleted", () => {
    const event = mapZulipEventToEnvelope({
      type: "delete_message",
      message_id: 10,
      stream_id: 20,
      stream_name: "engineering",
      topic: "deploys",
    }, "1.2.3");

    expect(event?.delivery.eventType).toBe("message.deleted");
    expect(event?.message.text).toBeNull();
  });

  test("returns null when a message event has no content", () => {
    expect(mapZulipEventToEnvelope(createMessageEvent({
      message: {
        id: 10,
        stream_id: 20,
        stream_name: "engineering",
        topic: "deploys",
        sender_id: 30,
        timestamp: 1_700_000_000,
      },
    }), "1.2.3")).toBeNull();
  });

  test("maps actor fields correctly", () => {
    const event = mapZulipEventToEnvelope(createMessageEvent({
      message: {
        id: 10,
        stream_id: 20,
        stream_name: "engineering",
        topic: "deploys",
        sender_id: 31,
        sender_email: "bot@example.com",
        sender_full_name: "Build Bot",
        sender_is_bot: true,
        content: "hello",
        timestamp: 1_700_000_000,
      },
    }), "1.2.3");

    expect(event?.actor).toEqual({
      id: "zulip:31",
      nativeId: "31",
      displayName: "Build Bot",
      handle: "bot@example.com",
      isBot: true,
    });
  });

  test("maps stream conversations to channel kind", () => {
    const event = mapZulipEventToEnvelope(createMessageEvent(), "1.2.3");
    expect(event?.conversation.kind).toBe("channel");
  });
});
