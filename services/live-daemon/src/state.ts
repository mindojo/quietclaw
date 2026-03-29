import {
  CapabilitiesResponseSchema,
  GatewayHealthResponseSchema,
  GroupMembersResponseSchema,
  GroupMessagesResponseSchema,
  GroupsResponseSchema,
  MessageReceivedEventPayloadSchema,
  PairQrResponseSchema,
  SendAckEventPayloadSchema,
  SendMessageResponseSchema,
  type GatewayGroup,
  type GatewayHealthResponse,
  type GatewayMessage,
  type GroupDiscoveryStatus,
  type GroupMember,
  type GroupMembersResponse,
  type GroupMessagesResponse,
  type GroupsResponse,
  type MessageReceivedEventPayload,
  type PairQrResponse,
  type SendAckEventPayload,
  type SendMessageRequest,
  type SendMessageResponse,
} from "@quietclaw/gateway-contract";

import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_TOKEN,
  GROUP_CATALOG_DEBOUNCE_MS,
  MAX_MESSAGE_COUNT,
  PRUNE_INTERVAL_MS,
  PROVIDER_ID,
  PROVIDER_VERSION,
  RETENTION_HOURS_MAX,
} from "./constants.js";
import { mapEnvelopeToGatewayMessage, resolveGroupName, resolveObservedMember } from "./ingest.js";
import { SseBroker } from "./sse/broker.js";
import type { GatewayEnvelope } from "./types.js";
import type { Clock } from "./util/clock.js";
import { SystemClock } from "./util/clock.js";
import { createGatewayMessageId } from "./util/ids.js";
import { pruneExpiredMessages } from "./util/prune.js";

type ObservedGroup = {
  id: string;
  name: string;
  status: GroupDiscoveryStatus;
  isTargetEligible: boolean;
  notes: string[];
  reliable: boolean;
  lastMessageAt: string | null;
  members: Map<string, GroupMember>;
};

export type LiveDaemonConfig = {
  host: string;
  port: number;
  token: string;
};

export class LiveDaemonState {
  readonly config: LiveDaemonConfig;
  readonly broker: SseBroker;

  private readonly clock: Clock;
  private readonly startedAtIso: string;
  private readonly startedAtMs: number;
  private readonly hiddenGroupIds = new Set<string>();
  private readonly messageIds = new Set<string>();
  private readonly groups = new Map<string, ObservedGroup>();
  private readonly messageListeners = new Set<(payload: MessageReceivedEventPayload) => void>();
  private readonly groupListeners = new Set<(payload: GroupsResponse) => void>();
  private messages: GatewayMessage[] = [];
  private sendCounter = 1;
  private pruneTimer: NodeJS.Timeout | null = null;
  private catalogUpdateTimer: NodeJS.Timeout | null = null;

  constructor(
    options: Partial<LiveDaemonConfig> & {
      broker?: SseBroker;
      clock?: Clock;
    } = {},
  ) {
    this.clock = options.clock ?? new SystemClock();
    this.broker = options.broker ?? new SseBroker(this.clock);
    this.config = {
      host: options.host ?? DEFAULT_HOST,
      port: options.port ?? DEFAULT_PORT,
      token: options.token ?? DEFAULT_TOKEN,
    };
    this.startedAtIso = this.clock.nowIso();
    this.startedAtMs = this.clock.nowMs();
  }

  start(): void {
    this.broker.start();
    if (this.pruneTimer !== null) {
      return;
    }

    this.pruneTimer = setInterval(() => {
      this.pruneExpiredMessages();
    }, PRUNE_INTERVAL_MS);
  }

  stop(): void {
    if (this.pruneTimer !== null) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.catalogUpdateTimer !== null) {
      clearTimeout(this.catalogUpdateTimer);
      this.catalogUpdateTimer = null;
    }
    this.broker.stop();
  }

  ingestEnvelope(envelope: GatewayEnvelope): { message: GatewayMessage; stored: boolean } {
    const message = mapEnvelopeToGatewayMessage(envelope);
    const observedMember = resolveObservedMember(envelope.payload);
    const stored = this.ingestMessage(message, resolveGroupName(envelope.payload), observedMember);
    return { message, stored };
  }

  ingestMessage(
    message: GatewayMessage,
    groupName: string,
    observedMember?: GroupMember,
  ): boolean {
    if (this.messageIds.has(message.id)) {
      if (observedMember && observedMember.id.length > 0) {
        const group = this.upsertGroup(message.groupId, groupName);
        group.members.set(observedMember.id, observedMember);
      }

      this.emitHealthUpdated();
      this.scheduleGroupCatalogUpdated();
      return false;
    }

    const group = this.upsertGroup(message.groupId, groupName);
    this.messageIds.add(message.id);
    this.messages.push(message);
    if (observedMember && observedMember.id.length > 0) {
      group.members.set(observedMember.id, observedMember);
    }
    group.lastMessageAt = this.maxTimestamp(group.lastMessageAt, message.timestamp);
    this.enforceMessageCap();
    this.emitMessageReceived(message, group.status);
    this.emitHealthUpdated();
    this.scheduleGroupCatalogUpdated();
    return true;
  }

  hideGroup(groupId: string): void {
    this.hiddenGroupIds.add(groupId);
    this.scheduleGroupCatalogUpdated();
  }

  getCapabilities() {
    return CapabilitiesResponseSchema.parse({
      apiVersion: "1.0",
      providerId: PROVIDER_ID,
      providerVersion: PROVIDER_VERSION,
      features: {
        qrPairing: false,
        historySync: true,
        groupMembershipSnapshots: true,
        messageSend: true,
        demoControls: false,
      },
      retentionHoursMax: RETENTION_HOURS_MAX,
      auth: {
        scheme: "Bearer",
        tokenRotationSupported: false,
      },
    });
  }

  getHealth(): GatewayHealthResponse {
    return GatewayHealthResponseSchema.parse({
      state: "CONNECTED",
      connected: true,
      pairingRequired: false,
      backfilling: false,
      since: this.startedAtIso,
      detail: "Live daemon is accepting adapter-sourced traffic.",
      qrAvailable: false,
      observedGroupCount: this.groups.size,
      catalogCompleteness: "observed_only",
      warnings: [
        "Catalog includes only groups observed by live traffic or backfill.",
      ],
    });
  }

  getPublicHealth() {
    return {
      status: "ok" as const,
      groups: this.groups.size,
      messages: this.messages.length,
      uptime: Math.floor((this.clock.nowMs() - this.startedAtMs) / 1000),
    };
  }

  getPairQr(): PairQrResponse {
    return PairQrResponseSchema.parse({
      available: false,
      expiresAt: null,
      dataUrlPng: null,
      detail: "QR pairing is not available in live ingest mode.",
    });
  }

  getGroups(): GroupsResponse {
    this.pruneExpiredMessages();

    return GroupsResponseSchema.parse({
      catalogCompleteness: "observed_only",
      gatewayState: "CONNECTED",
      groups: this.getVisibleGroups().map((group) => this.toGatewayGroup(group)),
      notices: [
        "This list reflects only groups observed by the live daemon.",
        "Additional groups may appear after traffic or backfill is observed.",
      ],
    });
  }

  getGroupCount(): number {
    return this.getVisibleGroups().length;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  onObservedMessage(listener: (payload: MessageReceivedEventPayload) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  onGroupCatalogUpdated(listener: (payload: GroupsResponse) => void): () => void {
    this.groupListeners.add(listener);
    return () => {
      this.groupListeners.delete(listener);
    };
  }

  getGroupMembers(groupId: string): GroupMembersResponse | null {
    const group = this.groups.get(groupId);
    if (!group) {
      return null;
    }

    return GroupMembersResponseSchema.parse({
      groupId: group.id,
      groupName: group.name,
      members: [...group.members.values()].sort((left, right) => {
        const leftName = left.displayName ?? left.id;
        const rightName = right.displayName ?? right.id;
        return leftName.localeCompare(rightName);
      }),
      snapshotAt: this.clock.nowIso(),
      reliable: group.reliable,
      notes: ["Membership snapshot derived from observed senders."],
    });
  }

  getMessages(params: {
    groupId: string;
    since: string;
    limit: number;
    cursor: string | null;
  }): GroupMessagesResponse | null {
    const group = this.groups.get(params.groupId);
    if (!group) {
      return null;
    }

    this.pruneExpiredMessages();

    const sinceMs = new Date(params.since).getTime();
    const filtered = this.messages
      .filter((message) => {
        return (
          message.groupId === params.groupId &&
          new Date(message.timestamp).getTime() >= sinceMs
        );
      })
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

    const offset = params.cursor === null ? 0 : Number.parseInt(params.cursor, 10);
    const page = filtered.slice(offset, offset + params.limit);
    const nextCursor =
      offset + params.limit < filtered.length ? String(offset + params.limit) : null;

    return GroupMessagesResponseSchema.parse({
      groupId: group.id,
      groupName: group.name,
      since: params.since,
      returnedCount: page.length,
      nextCursor,
      complete: true,
      messages: page,
      notes: [],
    });
  }

  sendMessage(input: SendMessageRequest): SendMessageResponse | null {
    if (!this.groups.has(input.targetGroupId)) {
      return null;
    }

    const response = SendMessageResponseSchema.parse({
      disposition: "queued",
      requestId: input.requestId,
      gatewayMessageId: createGatewayMessageId(this.sendCounter),
      detail: "Send request queued by live daemon.",
      blockedReason: null,
    });
    this.sendCounter += 1;
    this.emitSendAck(response);
    return response;
  }

  private upsertGroup(groupId: string, groupName: string): ObservedGroup {
    const existing = this.groups.get(groupId);

    if (existing) {
      existing.name = groupName;
      return existing;
    }

    const created: ObservedGroup = {
      id: groupId,
      name: groupName,
      status: "current",
      isTargetEligible: true,
      notes: ["Seen in current session."],
      reliable: true,
      lastMessageAt: null,
      members: new Map<string, GroupMember>(),
    };
    this.groups.set(created.id, created);
    return created;
  }

  private getVisibleGroups(): ObservedGroup[] {
    return [...this.groups.values()]
      .filter((group) => !this.hiddenGroupIds.has(group.id))
      .sort((left, right) => {
        if (left.lastMessageAt && right.lastMessageAt) {
          return right.lastMessageAt.localeCompare(left.lastMessageAt);
        }
        if (left.lastMessageAt) {
          return -1;
        }
        if (right.lastMessageAt) {
          return 1;
        }
        return left.name.localeCompare(right.name);
      });
  }

  private toGatewayGroup(group: ObservedGroup): GatewayGroup {
    const cutoffMs = this.clock.nowMs() - RETENTION_HOURS_MAX * 60 * 60 * 1000;
    const messageCount24h = this.messages.filter((message) => {
      return (
        message.groupId === group.id &&
        new Date(message.timestamp).getTime() >= cutoffMs
      );
    }).length;

    return {
      id: group.id,
      name: group.name,
      status: group.status,
      lastMessageAt: group.lastMessageAt,
      messageCount24h,
      memberCount: group.members.size,
      isTargetEligible: group.isTargetEligible,
      notes: group.notes,
    };
  }

  private maxTimestamp(current: string | null, next: string): string {
    if (current === null) {
      return next;
    }

    return current.localeCompare(next) >= 0 ? current : next;
  }

  private scheduleGroupCatalogUpdated(): void {
    if (this.catalogUpdateTimer !== null) {
      return;
    }

    this.catalogUpdateTimer = setTimeout(() => {
      this.catalogUpdateTimer = null;
      this.emitGroupCatalogUpdated();
    }, GROUP_CATALOG_DEBOUNCE_MS);
  }

  private emitHealthUpdated(): void {
    this.broker.emit("health.updated", this.getHealth());
  }

  private emitGroupCatalogUpdated(): void {
    const payload = this.getGroups();
    this.broker.emit("group.catalog.updated", payload);
    for (const listener of this.groupListeners) {
      listener(payload);
    }
  }

  private emitMessageReceived(
    message: GatewayMessage,
    groupStatus: GroupDiscoveryStatus,
  ): void {
    const payload = MessageReceivedEventPayloadSchema.parse({
      ...message,
      live: message.deliveryHint === "live",
      groupStatus,
    });

    this.broker.emit("message.received", payload);
    for (const listener of this.messageListeners) {
      listener(payload);
    }
  }

  private emitSendAck(response: SendMessageResponse): void {
    const payload: SendAckEventPayload = {
      requestId: response.requestId,
      gatewayMessageId: response.gatewayMessageId,
      disposition: response.disposition,
      detail: response.detail,
    };

    this.broker.emit("send.ack", SendAckEventPayloadSchema.parse(payload));
  }

  private pruneExpiredMessages(): void {
    this.messages = pruneExpiredMessages(this.messages, this.clock.now(), RETENTION_HOURS_MAX);
    this.rebuildMessageIndexesAndGroupState();
  }

  private enforceMessageCap(): void {
    if (this.messages.length <= MAX_MESSAGE_COUNT) {
      return;
    }

    this.messages = [...this.messages]
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .slice(-MAX_MESSAGE_COUNT);
    this.rebuildMessageIndexesAndGroupState();
  }

  private rebuildMessageIndexesAndGroupState(): void {
    this.messageIds.clear();
    const latestByGroup = new Map<string, string>();

    for (const message of this.messages) {
      this.messageIds.add(message.id);
      const current = latestByGroup.get(message.groupId) ?? null;
      latestByGroup.set(message.groupId, this.maxTimestamp(current, message.timestamp));
    }

    for (const group of this.groups.values()) {
      group.lastMessageAt = latestByGroup.get(group.id) ?? null;
    }
  }
}

export function createLiveDaemonState(
  options: Partial<LiveDaemonConfig> & {
    broker?: SseBroker;
    clock?: Clock;
  } = {},
): LiveDaemonState {
  return new LiveDaemonState(options);
}
