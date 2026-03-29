import { describe, expect, test } from "vitest";

import { mapMatrixEventToEnvelope } from "../../packages/adapter-matrix/src/mapper.js";
import type { MatrixSyncEvent } from "../../packages/adapter-matrix/src/types.js";

function createMatrixEvent(overrides: Partial<MatrixSyncEvent> = {}): MatrixSyncEvent {
  return {
    type: "m.room.message",
    event_id: "$event1",
    sender: "@alice:example.org",
    origin_server_ts: 1_700_000_000_000,
    room_id: "!room:example.org",
    content: {
      body: "hello matrix",
      msgtype: "m.text",
    },
    ...overrides,
  };
}

describe("mapMatrixEventToEnvelope", () => {
  test("maps a basic message to message.created", () => {
    const event = mapMatrixEventToEnvelope(createMatrixEvent(), "Ops", "1.2.3");

    expect(event).toMatchObject({
      adapter: { id: "matrix", version: "1.2.3", officiality: "open_protocol" },
      delivery: { mode: "websocket", eventType: "message.created" },
      conversation: { id: "matrix:!room:example.org", kind: "room", displayName: "Ops" },
      message: { id: "matrix:$event1", text: "hello matrix", edited: false },
    });
  });

  test("maps an edited message to message.updated", () => {
    const event = mapMatrixEventToEnvelope(createMatrixEvent({
      event_id: "$event2",
      content: {
        body: "* edited",
        "m.new_content": { body: "edited", msgtype: "m.text" },
        "m.relates_to": { rel_type: "m.replace", event_id: "$event1" },
      },
    }), "Ops", "1.2.3");

    expect(event?.delivery.eventType).toBe("message.updated");
    expect(event?.message.id).toBe("matrix:$event1");
    expect(event?.message.text).toBe("edited");
  });

  test("maps a redaction to message.deleted", () => {
    const event = mapMatrixEventToEnvelope(createMatrixEvent({
      type: "m.room.redaction",
      content: { redacts: "$event1" },
    }), "Ops", "1.2.3");

    expect(event?.delivery.eventType).toBe("message.deleted");
    expect(event?.message.text).toBeNull();
  });

  test("returns null when a message event has no content body", () => {
    expect(mapMatrixEventToEnvelope(createMatrixEvent({ content: {} }), "Ops", "1.2.3")).toBeNull();
  });

  test("maps actor fields correctly", () => {
    const event = mapMatrixEventToEnvelope(createMatrixEvent({ sender: "@bot:example.org" }), "Ops", "1.2.3");

    expect(event?.actor).toEqual({
      id: "matrix:@bot:example.org",
      nativeId: "@bot:example.org",
      displayName: null,
      handle: "@bot:example.org",
      isBot: false,
    });
  });

  test("uses room kind for conversations", () => {
    const event = mapMatrixEventToEnvelope(createMatrixEvent(), "Ops", "1.2.3");
    expect(event?.conversation.kind).toBe("room");
  });
});
