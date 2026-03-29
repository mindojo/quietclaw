import type { AdapterCapabilities, AdapterHealth, ChannelAdapter, IngestEmitter } from "@quietclaw/adapter-sdk";

import { MatrixApiClient } from "./client.js";
import { mapMatrixEventToEnvelope } from "./mapper.js";

const ADAPTER_VERSION = "1.0.0";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class MatrixAdapter implements ChannelAdapter {
  readonly id = "matrix";
  readonly displayName = "Matrix";

  private readonly client: MatrixApiClient;
  private readonly roomNames = new Map<string, string | null>();
  private health: AdapterHealth = {
    ok: false,
    state: "idle",
    detail: null,
    lastEventAt: null,
  };
  private running = false;

  constructor(homeserverUrl: string, accessToken: string) {
    this.client = new MatrixApiClient(homeserverUrl, accessToken);
  }

  getCapabilities(): AdapterCapabilities {
    return {
      officiality: "open_protocol",
      supportsLiveStream: true,
      supportsHistoryFetch: true,
      supportsMembershipSnapshots: true,
      supportsThreads: false,
      supportsEdits: true,
      requiresPublicEndpoint: false,
      selfHostableForTests: true,
    };
  }

  getHealth(): AdapterHealth {
    return { ...this.health };
  }

  async connect(emit: IngestEmitter): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.health = {
      ok: false,
      state: "connecting",
      detail: "Starting Matrix sync loop.",
      lastEventAt: this.health.lastEventAt,
    };

    let since: string | undefined;

    while (this.running) {
      try {
        const response = await this.client.sync(since);
        since = response.next_batch;

        this.health = {
          ok: true,
          state: "ready",
          detail: "Streaming Matrix sync events.",
          lastEventAt: this.health.lastEventAt,
        };

        const joinedRooms = response.rooms?.join ?? {};
        for (const [roomId, roomData] of Object.entries(joinedRooms)) {
          const roomName = this.roomNames.get(roomId) ?? null;
          const events = roomData.timeline?.events ?? [];

          for (const event of events) {
            const envelope = mapMatrixEventToEnvelope({ ...event, room_id: roomId }, roomName, ADAPTER_VERSION);
            if (envelope === null) {
              continue;
            }

            await emit(envelope);
            this.health = {
              ok: true,
              state: "ready",
              detail: "Streaming Matrix sync events.",
              lastEventAt: envelope.delivery.observedAt,
            };
          }
        }
      } catch (error) {
        if (!this.running) {
          break;
        }

        this.health = {
          ok: false,
          state: "degraded",
          detail: error instanceof Error ? error.message : "Matrix sync failed.",
          lastEventAt: this.health.lastEventAt,
        };
        await sleep(5_000);
      }
    }

    this.health = {
      ok: false,
      state: "idle",
      detail: "Matrix adapter disconnected.",
      lastEventAt: this.health.lastEventAt,
    };
  }

  async disconnect(): Promise<void> {
    this.running = false;
  }

  async runBackfill(emit: IngestEmitter, options?: { limit?: number }): Promise<void> {
    const response = await this.client.sync();
    const joinedRooms = response.rooms?.join ?? {};

    for (const roomId of Object.keys(joinedRooms)) {
      const events = await this.client.getRoomMessages(roomId, options?.limit ?? 100);
      const roomName = this.roomNames.get(roomId) ?? null;

      for (const event of events) {
        const envelope = mapMatrixEventToEnvelope({ ...event, room_id: roomId }, roomName, ADAPTER_VERSION);
        if (envelope !== null) {
          await emit({
            ...envelope,
            delivery: {
              ...envelope.delivery,
              isBackfill: true,
            },
          });
        }
      }
    }
  }

  async listConversations(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.client.sync();
    const joinedRooms = response.rooms?.join ?? {};

    return Object.keys(joinedRooms).map((roomId) => ({
      id: `matrix:${roomId}`,
      name: this.roomNames.get(roomId) ?? roomId,
    }));
  }

  async listMembers(conversationId: string): Promise<Array<{ id: string; displayName: string | null }>> {
    const roomId = conversationId.startsWith("matrix:") ? conversationId.slice("matrix:".length) : conversationId;
    const members = await this.client.getRoomMembers(roomId);

    return members.map((member) => ({
      id: `matrix:${member.state_key}`,
      displayName: member.content?.displayname ?? null,
    }));
  }
}
