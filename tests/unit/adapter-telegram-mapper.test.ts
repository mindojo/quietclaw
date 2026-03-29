import { describe, expect, test } from "vitest";

import { mapTelegramUpdateToEvent } from "../../packages/adapter-telegram/src/mapper.js";
import type { TelegramUpdate } from "../../packages/adapter-telegram/src/types.js";

function createUpdate(update: Partial<TelegramUpdate> = {}): TelegramUpdate {
  const base: TelegramUpdate = {
    update_id: 10,
    message: {
      message_id: 20,
      from: {
        id: 30,
        is_bot: false,
        first_name: "Alice",
        last_name: "Example",
        username: "alice",
      },
      chat: {
        id: -40,
        type: "group",
        title: "Builders",
      },
      date: 1_700_000_000,
      text: "hello",
    },
  };

  return {
    ...base,
    ...update,
  };
}

describe("mapTelegramUpdateToEvent", () => {
  test("maps a basic text message to message.created", () => {
    const event = mapTelegramUpdateToEvent(createUpdate(), "1.2.3");

    expect(event).toMatchObject({
      adapter: { id: "telegram", version: "1.2.3", officiality: "official" },
      delivery: { mode: "poll", eventType: "message.created" },
      conversation: { id: "telegram:-40", kind: "group", displayName: "Builders" },
      message: { id: "telegram:20", text: "hello", edited: false },
    });
  });

  test("maps an edited message to message.updated", () => {
    const update = createUpdate({
      edited_message: {
        message_id: 21,
        chat: { id: -40, type: "group", title: "Builders" },
        date: 1_700_000_000,
        edit_date: 1_700_000_100,
        text: "updated",
      },
    });
    delete update.message;

    const event = mapTelegramUpdateToEvent(update, "1.2.3");

    expect(event?.delivery.eventType).toBe("message.updated");
    expect(event?.message.edited).toBe(true);
  });

  test("maps a channel post to message.created", () => {
    const update = createUpdate({
      channel_post: {
        message_id: 22,
        chat: { id: -99, type: "channel", title: "Announcements" },
        date: 1_700_000_000,
        text: "news",
      },
    });
    delete update.message;

    const event = mapTelegramUpdateToEvent(update, "1.2.3");

    expect(event).toMatchObject({
      delivery: { eventType: "message.created" },
      conversation: { kind: "channel", displayName: "Announcements" },
    });
  });

  test("returns null when no message-like field exists", () => {
    expect(mapTelegramUpdateToEvent({ update_id: 1 }, "1.2.3")).toBeNull();
  });

  test("populates actor fields correctly", () => {
    const event = mapTelegramUpdateToEvent(createUpdate({
      message: {
        message_id: 20,
        from: {
          id: 31,
          is_bot: true,
          first_name: "Build",
          username: "builder_bot",
        },
        chat: { id: 5, type: "private", username: "builder_bot" },
        date: 1_700_000_000,
        text: "hello",
      },
    }), "1.2.3");

    expect(event?.actor).toEqual({
      id: "telegram:31",
      nativeId: "31",
      displayName: "Build",
      handle: "builder_bot",
      isBot: true,
    });
  });

  test("maps replies to replyToMessageId", () => {
    const event = mapTelegramUpdateToEvent(createUpdate({
      message: {
        message_id: 23,
        chat: { id: -40, type: "group", title: "Builders" },
        date: 1_700_000_000,
        text: "reply",
        reply_to_message: { message_id: 7 },
      },
    }), "1.2.3");

    expect(event?.message.replyToMessageId).toBe("telegram:7");
  });
});
