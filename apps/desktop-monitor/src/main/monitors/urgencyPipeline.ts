import {
  MessageReceivedEventPayloadSchema,
  type GroupsResponse,
  type MessageReceivedEventPayload,
} from "@quietclaw/gateway-contract";

import { readAppConfig, updateAppConfig } from "../config/store";
import type { ActivityKind } from "../config/schema";
import { nowIso, parseUtcIso, startOfWindow } from "../util/time";
import {
  buildUrgentFingerprint,
  hasActiveUrgentFingerprint,
  pruneExpiredUrgentFingerprints,
  rememberUrgentFingerprint,
} from "./dedupe";
import {
  cheapUrgentPrefilter,
  formatSenderName,
  formatSnippet,
} from "./normalization";
import {
  RunnerManager,
  RunnerQueueFullError,
  RunnerShutdownError,
  RunnerUnavailableError,
  type UrgencyPromptInput,
} from "./runnerManager";
import type { MessageSource, OutboundSender } from "./engine";

type UrgencyPipelineOptions = {
  appendActivity: (kind: ActivityKind, summary: string, detail: string | null) => void;
  getGroups: () => GroupsResponse | null;
  getMessageSource: () => MessageSource | null;
  getOutboundSender: () => OutboundSender | null;
  runnerManager: RunnerManager;
};

export class UrgencyPipeline {
  constructor(private readonly options: UrgencyPipelineOptions) {}

  async processMessage(eventPayload: unknown): Promise<void> {
    const payload = MessageReceivedEventPayloadSchema.parse(eventPayload);
    const source = this.options.getMessageSource();
    const sender = this.options.getOutboundSender();

    if (!source || !sender?.isReady()) {
      return;
    }

    const config = readAppConfig();
    if (!config.monitor.enabled) {
      return;
    }

    const watchedEntry = config.monitor.watchedGroups.find(
      (group) => group.groupId === payload.groupId && group.forwardUrgent,
    );
    if (!watchedEntry) {
      return;
    }

    const prefilter = cheapUrgentPrefilter(payload);
    if (prefilter.skip) {
      this.options.appendActivity(
        "urgent_skipped",
        "Skipped a live message before urgency inference.",
        formatPrefilterDetail(prefilter.reason),
      );
      return;
    }

    const dedupeFingerprint = buildUrgentFingerprint({
      groupId: payload.groupId,
      normalizedText: prefilter.normalizedText,
      timestamp: payload.timestamp,
      cooldownMinutes: config.monitor.urgentCooldownMinutes,
    });
    const duplicateNow = nowIso();
    let isDuplicate = false;

    updateAppConfig((current) => {
      const pruned = pruneExpiredUrgentFingerprints(
        current.dedupe.urgentFingerprints,
        duplicateNow,
      );
      isDuplicate = hasActiveUrgentFingerprint(pruned, dedupeFingerprint, duplicateNow);

      return {
        ...current,
        dedupe: {
          ...current.dedupe,
          urgentFingerprints: pruned,
        },
      };
    });

    if (isDuplicate) {
      this.options.appendActivity(
        "urgent_skipped",
        "Skipped a duplicate urgent alert during cooldown.",
        "cooldown duplicate",
      );
      return;
    }

    const groups = this.options.getGroups();
    const watchedGroupName = getGroupName(groups, payload.groupId, payload.groupName);
    const recentContext = await this.fetchRecentContext(source, payload);
    const promptInput: UrgencyPromptInput = {
      watchedGroupName,
      targetGroupName: "Telegram",
      timestamp: payload.timestamp,
      triggerMessage: {
        senderName: payload.senderName,
        text: payload.text,
        caption: payload.caption,
        hasAttachment: payload.hasAttachment,
        attachmentKind: payload.attachmentKind,
      },
      recentContext,
    };

    try {
      const result = await this.options.runnerManager.runUrgency(
        config.monitor.runnerPreference,
        promptInput,
        new AbortController().signal,
      );

      if (!result.output.urgent) {
        this.options.appendActivity(
          "urgent_skipped",
          "Urgency runner decided no alert was needed.",
          `${result.runnerId} confidence ${result.output.confidence.toFixed(2)}`,
        );
        return;
      }

      const snippet = formatSnippet(prefilter.meaningfulText, 240);
      const sendResult = await sender.sendUrgent(
        watchedGroupName,
        formatSenderName(payload.senderName),
        snippet || "(no text)",
        result.output.rationale,
      );

      if (!sendResult.ok) {
        this.options.appendActivity(
          "urgent_blocked",
          "Telegram blocked an urgent alert send.",
          sendResult.detail,
        );
        return;
      }

      updateAppConfig((current) => ({
        ...current,
        dedupe: {
          ...current.dedupe,
          urgentFingerprints: rememberUrgentFingerprint(
            current.dedupe.urgentFingerprints,
            {
              fingerprint: dedupeFingerprint,
              nowIso: nowIso(),
              cooldownMinutes: current.monitor.urgentCooldownMinutes,
            },
          ),
        },
      }));

      this.options.appendActivity(
        "urgent_queued",
        "Sent urgent alert to Telegram.",
        `${result.runnerId} ${result.output.category} ${result.output.confidence.toFixed(2)}`,
      );
    } catch (error) {
      if (error instanceof RunnerQueueFullError) {
        this.options.appendActivity(
          "urgent_skipped",
          "Skipped an urgent alert because the runner queue is full.",
          "runner queue full",
        );
        return;
      }

      if (error instanceof RunnerUnavailableError) {
        this.options.appendActivity(
          "runner_unavailable",
          "Urgent inference runner is unavailable.",
          error.message,
        );
        return;
      }

      if (error instanceof RunnerShutdownError) {
        this.options.appendActivity(
          "urgent_blocked",
          "Urgent alert stopped during app shutdown.",
          "app shutdown",
        );
        return;
      }

      this.options.appendActivity(
        "urgent_blocked",
        "Urgent inference or send failed.",
        sanitizeErrorDetail(error),
      );
    }
  }

  private async fetchRecentContext(
    source: MessageSource,
    payload: MessageReceivedEventPayload,
  ): Promise<UrgencyPromptInput["recentContext"]> {
    try {
      const messageTime = parseUtcIso(payload.timestamp);
      const since = messageTime.minus({ hours: 3 });
      const nowMinus24h = startOfWindow(24);
      const response = await source.getGroupMessages(
        payload.groupId,
        (since > nowMinus24h ? since : nowMinus24h).toISO() ?? payload.timestamp,
        50,
      );
      const history = response.messages
        .filter((message) => parseUtcIso(message.timestamp).toMillis() <= messageTime.toMillis())
        .slice(-12)
        .map((message) => ({
          timestamp: message.timestamp,
          senderName: message.senderName,
          text: message.text,
          caption: message.caption,
        }));

      if (history.some((message) => message.timestamp === payload.timestamp)) {
        return history;
      }

      return [
        ...history.slice(-11),
        {
          timestamp: payload.timestamp,
          senderName: payload.senderName,
          text: payload.text,
          caption: payload.caption,
        },
      ];
    } catch {
      return [
        {
          timestamp: payload.timestamp,
          senderName: payload.senderName,
          text: payload.text,
          caption: payload.caption,
        },
      ];
    }
  }
}

function getGroupName(
  groups: GroupsResponse | null,
  groupId: string,
  fallback?: string,
): string {
  return groups?.groups.find((group) => group.id === groupId)?.name ?? fallback ?? groupId;
}

function formatPrefilterDetail(reason: string): string {
  switch (reason) {
    case "empty":
      return "message had no meaningful text";
    case "short":
      return "message normalized below 3 characters";
    case "symbols_only":
      return "message contained only symbols or emoji";
    case "noise":
      return "message matched a known low-signal pattern";
    default:
      return reason;
  }
}

function sanitizeErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected monitor error.";
}
