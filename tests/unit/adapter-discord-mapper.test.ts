import { describe, expect, test } from "vitest";

import { mapDiscordEventToEnvelope } from "../../packages/adapter-discord/src/mapper.js";

describe("mapDiscordEventToEnvelope", () => {
  test("maps a basic message to message.created", () => {
    const event = mapDiscordEventToEnvelope({
      type: "MESSAGE_CREATE",
      data: {
        id: "m1",
        channel_id: "c1",
        guild_id: "g1",
        content: "hello discord",
        timestamp: "2023-11-14T22:13:20.000Z",
        author: {
          id: "u1",
          username: "alice",
          global_name: "Alice",
          bot: false,
        },
      },
    }, "1.2.3");

    expect(event).toMatchObject({
      adapter: { id: "discord", version: "1.2.3", officiality: "official" },
      delivery: { mode: "websocket", eventType: "message.created" },
      conversation: { id: "discord:c1", kind: "channel" },
      message: { id: "discord:m1", text: "hello discord", edited: false },
    });
  });

  test("maps an edited message to message.updated", () => {
    const event = mapDiscordEventToEnvelope({
      type: "MESSAGE_UPDATE",
      data: {
        id: "m1",
        channel_id: "c1",
        guild_id: "g1",
        content: "edited discord",
        timestamp: "2023-11-14T22:13:20.000Z",
        edited_timestamp: "2023-11-14T22:15:00.000Z",
        author: {
          id: "u1",
          username: "alice",
          global_name: "Alice",
          bot: false,
        },
      },
    }, "1.2.3");

    expect(event?.delivery.eventType).toBe("message.updated");
    expect(event?.message.text).toBe("edited discord");
    expect(event?.message.edited).toBe(true);
  });

  test("maps a deleted message to message.deleted", () => {
    const event = mapDiscordEventToEnvelope({
      type: "MESSAGE_DELETE",
      data: {
        id: "m1",
        channel_id: "c1",
        guild_id: "g1",
      },
    }, "1.2.3");

    expect(event?.delivery.eventType).toBe("message.deleted");
    expect(event?.message.text).toBeNull();
  });

  test("returns null when message content is unavailable", () => {
    expect(mapDiscordEventToEnvelope({
      type: "MESSAGE_CREATE",
      data: {
        id: "m1",
        channel_id: "c1",
        guild_id: "g1",
        timestamp: "2023-11-14T22:13:20.000Z",
        author: {
          id: "u1",
          username: "alice",
        },
      },
    }, "1.2.3")).toBeNull();
  });

  test("maps actor fields correctly", () => {
    const event = mapDiscordEventToEnvelope({
      type: "MESSAGE_CREATE",
      data: {
        id: "m1",
        channel_id: "c1",
        content: "hello discord",
        timestamp: "2023-11-14T22:13:20.000Z",
        author: {
          id: "u2",
          username: "buildbot",
          global_name: "Build Bot",
          bot: true,
        },
      },
    }, "1.2.3");

    expect(event?.actor).toEqual({
      id: "discord:u2",
      nativeId: "u2",
      displayName: "Build Bot",
      handle: "buildbot",
      isBot: true,
    });
  });

  test("maps DM-group style conversations to group kind", () => {
    const event = mapDiscordEventToEnvelope({
      type: "MESSAGE_CREATE",
      data: {
        id: "m1",
        channel_id: "c1",
        content: "hello discord",
        timestamp: "2023-11-14T22:13:20.000Z",
        author: {
          id: "u1",
          username: "alice",
        },
      },
    }, "1.2.3");

    expect(event?.conversation.kind).toBe("group");
  });
});
