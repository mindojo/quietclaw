import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { zodToJsonSchema } from "zod-to-json-schema";

import { DigestDecisionSchema, UrgencyDecisionSchema } from "./common.js";
import {
  EventEnvelopeSchema,
  GroupCatalogUpdatedPayloadSchema,
  HeartbeatEventPayloadSchema,
  HealthUpdatedEventPayloadSchema,
  MessageReceivedEventPayloadSchema,
  SendAckEventPayloadSchema,
} from "./events.js";
import {
  SendMessageRequestSchema,
  SendMessageResponseSchema,
} from "./send.js";

const schemaDefinitions = {
  urgencyDecision: {
    filename: "urgency-decision.json",
    name: "UrgencyDecision",
    schema: UrgencyDecisionSchema,
  },
  digestDecision: {
    filename: "digest-decision.json",
    name: "DigestDecision",
    schema: DigestDecisionSchema,
  },
  sendMessageRequest: {
    filename: "send-message-request.json",
    name: "SendMessageRequest",
    schema: SendMessageRequestSchema,
  },
  sendMessageResponse: {
    filename: "send-message-response.json",
    name: "SendMessageResponse",
    schema: SendMessageResponseSchema,
  },
  eventEnvelope: {
    filename: "event-envelope.json",
    name: "EventEnvelope",
    schema: EventEnvelopeSchema,
  },
  heartbeatEventPayload: {
    filename: "heartbeat-event-payload.json",
    name: "HeartbeatEventPayload",
    schema: HeartbeatEventPayloadSchema,
  },
  healthUpdatedEventPayload: {
    filename: "health-updated-event-payload.json",
    name: "HealthUpdatedEventPayload",
    schema: HealthUpdatedEventPayloadSchema,
  },
  groupCatalogUpdatedPayload: {
    filename: "group-catalog-updated-payload.json",
    name: "GroupCatalogUpdatedPayload",
    schema: GroupCatalogUpdatedPayloadSchema,
  },
  messageReceivedEventPayload: {
    filename: "message-received-event-payload.json",
    name: "MessageReceivedEventPayload",
    schema: MessageReceivedEventPayloadSchema,
  },
  sendAckEventPayload: {
    filename: "send-ack-event-payload.json",
    name: "SendAckEventPayload",
    schema: SendAckEventPayloadSchema,
  },
} as const;

export const jsonSchemaBundle = Object.freeze(
  Object.fromEntries(
    Object.entries(schemaDefinitions).map(([key, value]) => [
      key,
      zodToJsonSchema(value.schema, value.name),
    ]),
  ),
);

export async function writeJsonSchemaBundle(
  outputDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../dist/json-schema",
  ),
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  await Promise.all(
    Object.values(schemaDefinitions).map(async ({ filename, name, schema }) => {
      const schemaJson = zodToJsonSchema(schema, name);
      await writeFile(
        path.join(outputDir, filename),
        `${JSON.stringify(schemaJson, null, 2)}\n`,
        "utf8",
      );
    }),
  );
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;
const currentPath = fileURLToPath(import.meta.url);

if (invokedPath !== null && invokedPath === currentPath) {
  await writeJsonSchemaBundle();
}
