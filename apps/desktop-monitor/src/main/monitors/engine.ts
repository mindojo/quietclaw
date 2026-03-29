import type {
  GroupsResponse,
  GroupMessagesResponse,
  MessageReceivedEventPayload,
} from "@quietclaw/gateway-contract";

import type { RunnerStatus } from "../../preload/api";
import type { ActivityKind } from "../config/schema";
import { log } from "../logging";
import { readAppConfig } from "../config/store";
import { DigestPipeline } from "./digestPipeline";
import { RunnerManager } from "./runnerManager";
import { DigestScheduler } from "./scheduler";
import { UrgencyPipeline } from "./urgencyPipeline";

export type MessageSource = {
  getGroups(): Promise<GroupsResponse>;
  getGroupMessages(
    groupId: string,
    since: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<GroupMessagesResponse>;
};

export interface OutboundSender {
  isReady(): boolean;
  sendDigest(title: string, body: string): Promise<{ ok: boolean; detail: string }>;
  sendUrgent(
    groupName: string,
    senderName: string,
    snippet: string,
    rationale: string,
  ): Promise<{ ok: boolean; detail: string }>;
}

type MonitorEngineOptions = {
  appendActivity: (kind: ActivityKind, summary: string, detail: string | null) => void;
  getGroups: () => GroupsResponse | null;
  getMessageSource: () => MessageSource | null;
  getOutboundSender: () => OutboundSender | null;
};

type ManualRunResult = {
  ok: boolean;
  blocked: boolean;
  detail: string;
  previewText: string | null;
};

export class MonitorEngine {
  private readonly runnerManager: RunnerManager;
  private readonly urgencyPipeline: UrgencyPipeline;
  private readonly digestPipeline: DigestPipeline;
  private readonly scheduler: DigestScheduler;

  constructor(private readonly options: MonitorEngineOptions) {
    this.runnerManager = new RunnerManager({
      onFallbackWarning: (summary, detail) => {
        this.options.appendActivity("runner_unavailable", summary, detail);
      },
    });
    this.urgencyPipeline = new UrgencyPipeline({
      appendActivity: this.options.appendActivity,
      getGroups: this.options.getGroups,
      getMessageSource: this.options.getMessageSource,
      getOutboundSender: this.options.getOutboundSender,
      runnerManager: this.runnerManager,
    });
    this.digestPipeline = new DigestPipeline({
      appendActivity: this.options.appendActivity,
      getGroups: this.options.getGroups,
      getMessageSource: this.options.getMessageSource,
      getOutboundSender: this.options.getOutboundSender,
      runnerManager: this.runnerManager,
    });
    this.scheduler = new DigestScheduler({
      onDigestStarted: () => {
        this.options.appendActivity("digest_started", "Daily digest run started.", null);
      },
      onDigestDue: () => this.digestPipeline.runScheduled(),
      onError: (error) => {
        log.warn("Digest scheduler failed.", error);
      },
    });
  }

  start(): void {
    this.scheduler.start();
  }

  async shutdown(): Promise<void> {
    this.scheduler.stop();
    await this.runnerManager.shutdown();
  }

  async handleMessageReceived(payload: MessageReceivedEventPayload): Promise<void> {
    if (!payload.live) {
      return;
    }

    await this.urgencyPipeline.processMessage(payload);
  }

  async getRunnerStatus(): Promise<RunnerStatus[]> {
    return this.runnerManager.getRunnerStatus(readAppConfig().monitor.runnerPreference);
  }

  async runManualTestSummary(): Promise<ManualRunResult> {
    return this.digestPipeline.runManualTest();
  }
}
