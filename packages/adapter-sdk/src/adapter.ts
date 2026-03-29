import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

export type IngestEmitter = (event: NormalizedEventEnvelope) => Promise<void>;

export type AdapterHealth = {
  ok: boolean;
  state: "idle" | "connecting" | "ready" | "degraded" | "error";
  detail: string | null;
  lastEventAt: string | null;
};

export type AdapterCapabilities = {
  officiality: "official" | "open_protocol" | "community" | "experimental";
  supportsLiveStream: boolean;
  supportsHistoryFetch: boolean;
  supportsMembershipSnapshots: boolean;
  supportsThreads: boolean;
  supportsEdits: boolean;
  requiresPublicEndpoint: boolean;
  selfHostableForTests: boolean;
};

export type AdapterErrorCategory =
  | "auth_error"
  | "scope_error"
  | "transport_error"
  | "rate_limit"
  | "permissions_error"
  | "unsupported_event"
  | "parse_error"
  | "provider_outage"
  | "operator_misconfig";

export interface ChannelAdapter {
  readonly id: string;
  readonly displayName: string;
  getCapabilities(): AdapterCapabilities;
  getHealth(): AdapterHealth;
  connect(emit: IngestEmitter): Promise<void>;
  disconnect(): Promise<void>;
  runBackfill?(emit: IngestEmitter, options?: { limit?: number }): Promise<void>;
  listConversations?(): Promise<Array<{ id: string; name: string }>>;
  listMembers?(conversationId: string): Promise<Array<{ id: string; displayName: string | null }>>;
}
