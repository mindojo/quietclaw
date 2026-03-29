import { describe, expect, test } from "vitest";

import { mapMattermostEventToEnvelope } from "../../packages/adapter-mattermost/src/mapper.js";
import type { MattermostChannel, MattermostPost, MattermostSocketEvent, MattermostUser } from "../../packages/adapter-mattermost/src/types.js";

const user: MattermostUser = {
  id: "u1",
  username: "alice",
  first_name: "Alice",
  last_name: "Example",
  is_bot: false,
};

const openChannel: MattermostChannel = {
  id: "c1",
  display_name: "Town Square",
  name: "town-square",
  type: "O",
};

const privateChannel: MattermostChannel = {
  id: "c2",
  display_name: "Incident Room",
  name: "incident-room",
  type: "P",
};

function createPost(overrides: Partial<MattermostPost> = {}): MattermostPost {
  return {
    id: "p1",
    channel_id: "c1",
    user_id: "u1",
    message: "hello mattermost",
    create_at: 1_700_000_000_000,
    ...overrides,
  };
}

function createEvent(overrides: Partial<MattermostSocketEvent> = {}): MattermostSocketEvent {
  return {
    event: "posted",
    data: {
      channel_type: "O",
      post: JSON.stringify(createPost()),
    },
    broadcast: {
      channel_id: "c1",
    },
    ...overrides,
  };
}

describe("mapMattermostEventToEnvelope", () => {
  test("maps a basic message to message.created", () => {
    const event = mapMattermostEventToEnvelope(createEvent(), "1.2.3", { channel: openChannel, user });

    expect(event).toMatchObject({
      adapter: { id: "mattermost", version: "1.2.3", officiality: "open_protocol" },
      delivery: { mode: "websocket", eventType: "message.created" },
      conversation: { id: "mattermost:c1", kind: "channel", displayName: "Town Square" },
      message: { id: "mattermost:p1", text: "hello mattermost", edited: false },
    });
  });

  test("maps an edited message to message.updated", () => {
    const event = mapMattermostEventToEnvelope(createEvent({
      event: "post_edited",
      data: {
        channel_type: "O",
        post: JSON.stringify(createPost({ message: "edited mattermost", edit_at: 1_700_000_100_000 })),
      },
    }), "1.2.3", { channel: openChannel, user });

    expect(event?.delivery.eventType).toBe("message.updated");
    expect(event?.message.text).toBe("edited mattermost");
    expect(event?.message.edited).toBe(true);
  });

  test("maps a deleted message to message.deleted", () => {
    const event = mapMattermostEventToEnvelope(createEvent({
      event: "post_deleted",
      data: {
        channel_type: "O",
        post: JSON.stringify(createPost()),
      },
    }), "1.2.3", { channel: openChannel, user });

    expect(event?.delivery.eventType).toBe("message.deleted");
    expect(event?.message.text).toBeNull();
  });

  test("returns null when a created event has no message text", () => {
    expect(mapMattermostEventToEnvelope(createEvent({
      data: {
        channel_type: "O",
        post: JSON.stringify(createPost({ message: undefined })),
      },
    }), "1.2.3", { channel: openChannel, user })).toBeNull();
  });

  test("maps actor fields correctly", () => {
    const event = mapMattermostEventToEnvelope(createEvent(), "1.2.3", { channel: openChannel, user });

    expect(event?.actor).toEqual({
      id: "mattermost:u1",
      nativeId: "u1",
      displayName: "Alice Example",
      handle: "alice",
      isBot: false,
    });
  });

  test("maps private channels to group kind", () => {
    const event = mapMattermostEventToEnvelope(createEvent({
      data: {
        channel_type: "P",
        post: JSON.stringify(createPost({ channel_id: "c2" })),
      },
      broadcast: { channel_id: "c2" },
    }), "1.2.3", { channel: privateChannel, user });

    expect(event?.conversation.kind).toBe("group");
  });
});
