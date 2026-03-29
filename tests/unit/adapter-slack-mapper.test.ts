import { describe, expect, test } from "vitest";

import { mapSlackEventToEnvelope } from "../../packages/adapter-slack/src/mapper.js";
import type { SlackConversation, SlackMessageEvent } from "../../packages/adapter-slack/src/types.js";

const publicChannel: SlackConversation = { id: "C123", name: "general", is_channel: true };
const privateChannel: SlackConversation = { id: "G123", name: "ops", is_group: true, is_private: true };

function createSlackMessage(overrides: Partial<SlackMessageEvent> = {}): SlackMessageEvent {
  return {
    type: "message",
    channel: "C123",
    ts: "1700000000.100000",
    user: "U123",
    text: "hello slack",
    channel_type: "channel",
    ...overrides,
  };
}

describe("mapSlackEventToEnvelope", () => {
  test("maps a basic message to message.created", () => {
    const event = mapSlackEventToEnvelope(createSlackMessage(), "1.2.3", { channel: publicChannel });

    expect(event).toMatchObject({
      adapter: { id: "slack", version: "1.2.3", officiality: "official" },
      delivery: { mode: "websocket", eventType: "message.created" },
      conversation: { id: "slack:C123", kind: "channel", displayName: "general" },
      message: { id: "slack:1700000000.100000", text: "hello slack", edited: false },
    });
  });

  test("maps an edited message to message.updated", () => {
    const event = mapSlackEventToEnvelope(createSlackMessage({
      subtype: "message_changed",
      message: {
        ts: "1700000000.100000",
        user: "U123",
        text: "updated slack",
        edited: { user: "U123", ts: "1700000100.000000" },
      },
    }), "1.2.3", { channel: publicChannel });

    expect(event?.delivery.eventType).toBe("message.updated");
    expect(event?.message.text).toBe("updated slack");
    expect(event?.message.edited).toBe(true);
  });

  test("maps a deleted message to message.deleted", () => {
    const event = mapSlackEventToEnvelope(createSlackMessage({
      subtype: "message_deleted",
      deleted_ts: "1700000000.100000",
      previous_message: { ts: "1700000000.100000", user: "U123", text: "gone" },
    }), "1.2.3", { channel: publicChannel });

    expect(event?.delivery.eventType).toBe("message.deleted");
    expect(event?.message.text).toBeNull();
  });

  test("returns null when a created event has no message text", () => {
    expect(mapSlackEventToEnvelope(createSlackMessage({ text: undefined }), "1.2.3", { channel: publicChannel })).toBeNull();
  });

  test("maps actor fields correctly", () => {
    const event = mapSlackEventToEnvelope(createSlackMessage({ user: "U999" }), "1.2.3", { channel: publicChannel });

    expect(event?.actor).toEqual({
      id: "slack:U999",
      nativeId: "U999",
      displayName: null,
      handle: "U999",
      isBot: false,
    });
  });

  test("maps private conversations to group kind", () => {
    const event = mapSlackEventToEnvelope(createSlackMessage({
      channel: "G123",
      channel_type: "group",
    }), "1.2.3", { channel: privateChannel });

    expect(event?.conversation.kind).toBe("group");
  });
});
