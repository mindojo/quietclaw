import type { IngestEmitter } from "@quietclaw/adapter-sdk";
import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

export class FakeIngestEmitter {
  readonly events: NormalizedEventEnvelope[] = [];

  readonly emit: IngestEmitter = async (event) => {
    this.events.push(event);
  };
}
