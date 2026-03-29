import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { MatrixSyncEvent } from "./types.js";

export function mapMatrixEventToEnvelope(
  event: MatrixSyncEvent,
  roomName: string | null,
  adapterVersion: string,
): NormalizedEventEnvelope | null {
  if (!event.room_id) {
    return null;
  }

  let eventType: "message.created" | "message.updated" | "message.deleted" | null = null;
  let messageId = event.event_id;
  let text: string | null = null;
  let edited = false;

  if (event.type === "m.room.message") {
    const relationType = event.content?.["m.relates_to"]?.rel_type;
    if (relationType === "m.replace") {
      eventType = "message.updated";
      messageId = event.content?.["m.relates_to"]?.event_id ?? event.event_id;
      text = event.content?.["m.new_content"]?.body ?? event.content?.body ?? null;
      edited = true;
    } else {
      eventType = "message.created";
      text = event.content?.body ?? null;
    }
  } else if (event.type === "m.room.redaction") {
    eventType = "message.deleted";
    messageId = event.content?.redacts ?? event.event_id;
    text = null;
  }

  if (eventType === null) {
    return null;
  }

  if (text === null && eventType !== "message.deleted") {
    return null;
  }

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "matrix",
      version: adapterVersion,
      officiality: "open_protocol",
    },
    delivery: {
      mode: "websocket",
      eventType,
      eventId: `matrix:${event.room_id}:${event.event_id}`,
      occurredAt: new Date(event.origin_server_ts).toISOString(),
      observedAt: new Date().toISOString(),
      isBackfill: false,
    },
    conversation: {
      id: `matrix:${event.room_id}`,
      nativeId: event.room_id,
      kind: "room",
      displayName: roomName,
      tenantId: null,
      threadId: null,
    },
    actor: {
      id: `matrix:${event.sender}`,
      nativeId: event.sender,
      displayName: null,
      handle: event.sender,
      isBot: false,
    },
    message: {
      id: `matrix:${messageId}`,
      nativeId: messageId,
      text,
      html: null,
      attachments: [],
      replyToMessageId: null,
      edited,
      languageHint: null,
    },
    capabilities: {
      history: "full",
      membership: "full",
    },
    sourceMeta: {
      rawType: event.type,
      roomId: event.room_id,
    },
  };
}
