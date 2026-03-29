import { expect } from "vitest";

import type { ChannelAdapter } from "@quietclaw/adapter-sdk";
import { NormalizedEventEnvelopeSchema } from "@quietclaw/ingest-contract";

import type { AdapterFixtures } from "./fixtures.js";
import { FakeIngestEmitter } from "./fakeEmitter.js";

async function waitForReady(adapter: ChannelAdapter, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (adapter.getHealth().state === "ready") {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }

  throw new Error(`Adapter ${adapter.id} did not reach ready state within ${timeoutMs}ms.`);
}

export async function runAdapterConformanceTests(
  createAdapter: () => ChannelAdapter,
  _fixtures: AdapterFixtures,
): Promise<void> {
  const adapter = createAdapter();
  const emitter = new FakeIngestEmitter();

  expect(adapter.id.length).toBeGreaterThan(0);
  expect(adapter.getHealth().state).toBe("idle");
  expect(adapter.getCapabilities().officiality).toBeDefined();

  const connectPromise = adapter.connect(emitter.emit);

  expect(adapter.getHealth().state).toBe("connecting");

  try {
    await waitForReady(adapter, 250);

    expect(adapter.getHealth().state).toBe("ready");

    for (const event of emitter.events) {
      const parsed = NormalizedEventEnvelopeSchema.parse(event);
      expect(parsed.adapter.id.length).toBeGreaterThan(0);
      expect(parsed.adapter.officiality).toBe(adapter.getCapabilities().officiality);
      expect(parsed.delivery.eventId.length).toBeGreaterThan(0);
      expect(parsed.delivery.occurredAt.length).toBeGreaterThan(0);
      expect(parsed.delivery.observedAt.length).toBeGreaterThan(0);
      expect(parsed.conversation.id.length).toBeGreaterThan(0);
      expect(parsed.actor.id.length).toBeGreaterThan(0);
      expect(parsed.message.id.length).toBeGreaterThan(0);
    }
  } finally {
    await adapter.disconnect();
    await Promise.race([
      connectPromise,
      new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      }),
    ]);
  }
}
