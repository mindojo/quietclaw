import type { GatewayMessage, GroupsResponse } from "@quietclaw/gateway-contract";

import { readAppConfig, updateAppConfig } from "../config/store";
import type { ActivityKind } from "../config/schema";
import { formatLocalTimestamp, minutesSince, nowIso, nowUtc } from "../util/time";
import { cheapUrgentPrefilter, extractMeaningfulText } from "./normalization";
import {
  RunnerManager,
  RunnerShutdownError,
  RunnerUnavailableError,
  type DigestPromptInput,
} from "./runnerManager";
import type { MessageSource, OutboundSender } from "./engine";

type DigestPipelineOptions = {
  appendActivity: (kind: ActivityKind, summary: string, detail: string | null) => void;
  getGroups: () => GroupsResponse | null;
  getMessageSource: () => MessageSource | null;
  getOutboundSender: () => OutboundSender | null;
  runnerManager: RunnerManager;
};

type SchedulerRunOutcome = {
  status: "success" | "blocked" | "error";
  detail: string;
};

type ManualRunResult = {
  ok: boolean;
  blocked: boolean;
  detail: string;
  previewText: string | null;
};

type DigestSource = {
  watchedGroups: Array<{ id: string; name: string }>;
  messages: GatewayMessage[];
  notes: string[];
  since: string;
  until: string;
};

export class DigestPipeline {
  constructor(private readonly options: DigestPipelineOptions) {}

  async runScheduled(): Promise<SchedulerRunOutcome> {
    try {
      const result = await this.runInternal("digest");
      return {
        status: result.status,
        detail: result.detail,
      };
    } catch (error) {
      this.options.appendActivity(
        "digest_blocked",
        "Daily digest run failed.",
        sanitizeErrorDetail(error),
      );

      return {
        status: "error",
        detail: sanitizeErrorDetail(error),
      };
    }
  }

  async runManualTest(): Promise<ManualRunResult> {
    try {
      const result = await this.runInternal("manual_test");

      return {
        ok: result.status === "success" && Boolean(result.previewText),
        blocked: result.status === "blocked",
        detail: result.detail,
        previewText: result.previewText,
      };
    } catch (error) {
      return {
        ok: false,
        blocked: false,
        detail: sanitizeErrorDetail(error),
        previewText: null,
      };
    }
  }

  private async runInternal(
    reason: "digest" | "manual_test",
  ): Promise<SchedulerRunOutcome & { previewText: string | null }> {
    const config = readAppConfig();
    const source = this.options.getMessageSource();
    const sender = this.options.getOutboundSender();
    const summaryGroups = config.monitor.watchedGroups.filter((group) => group.dailySummary);

    if (!source) {
      return blocked(
        this.options,
        "Digest run blocked because the daemon is unavailable.",
        "daemon unavailable",
      );
    }

    if (!sender?.isReady()) {
      return blocked(
        this.options,
        "Digest run blocked because Telegram is not ready.",
        "telegram unavailable",
      );
    }

    if (!config.monitor.enabled || summaryGroups.length === 0) {
      return blocked(
        this.options,
        "Digest run blocked because monitor settings are incomplete.",
        "daily summary groups missing",
      );
    }

    const groups = this.options.getGroups();
    const digestSource = await this.fetchDigestSource(
      source,
      groups,
      summaryGroups.map((group) => group.groupId),
    );

    if ("blocked" in digestSource) {
      return blocked(
        this.options,
        "Digest run blocked while fetching source messages.",
        digestSource.detail,
      );
    }

    const meaningfulMessages = digestSource.messages.filter((message) => {
      const meaningfulText = extractMeaningfulText(message);

      if (!meaningfulText) {
        return false;
      }

      return !cheapUrgentPrefilter(message).skip;
    });

    if (meaningfulMessages.length === 0) {
      if (reason === "manual_test") {
        const title = "QuietClaw test summary";
        const body = buildManualConfirmationMessage({
          timeZone: config.monitor.digestTimezone,
        });
        const previewText = joinDigestPreview(title, body);
        const sendResult = await sender.sendDigest(title, body);

        if (!sendResult.ok) {
          return blocked(
            this.options,
            "Telegram blocked the manual test summary.",
            sendResult.detail,
          );
        }

        this.options.appendActivity(
          "manual_test_sent",
          "Sent manual test summary to Telegram.",
          "no meaningful activity in the last 24 hours",
        );
        return {
          status: "success",
          detail: sendResult.detail,
          previewText,
        };
      }

      this.options.appendActivity(
        "digest_empty",
        "Digest run found no meaningful messages in the last 24 hours.",
        null,
      );
      return {
        status: "success",
        detail: "No meaningful messages were available for a digest.",
        previewText: null,
      };
    }

    const duplicatePrevention = checkDigestDuplicatePrevention();
    if (duplicatePrevention.blocked) {
      return blocked(
        this.options,
        "Digest run blocked by duplicate prevention.",
        duplicatePrevention.detail,
      );
    }

    const promptInput: DigestPromptInput = {
      watchedGroups: digestSource.watchedGroups,
      targetGroupName: "Telegram",
      since: digestSource.since,
      until: digestSource.until,
      notes: digestSource.notes,
      messages: meaningfulMessages.map((message) => ({
        groupName: getGroupName(groups, message.groupId, message.groupName),
        timestamp: message.timestamp,
        senderName: message.senderName,
        text: message.text,
        caption: message.caption,
        hasAttachment: message.hasAttachment,
        attachmentKind: message.attachmentKind,
      })),
    };

    try {
      const result = await this.options.runnerManager.runDigest(
        config.monitor.runnerPreference,
        promptInput,
        new AbortController().signal,
      );

      if (!result.output.shouldSend) {
        return {
          status: "success",
          detail: "Runner decided not to send a digest.",
          previewText: null,
        };
      }

      if (!result.output.summary.trim()) {
        return blocked(
          this.options,
          "Digest runner returned an empty summary.",
          result.runnerId,
        );
      }

      const title = result.output.title.trim() || "QuietClaw digest";
      const body = formatDigestBody({
        summary: result.output.summary,
        bullets: result.output.bullets,
        sourceGroups: digestSource.watchedGroups.map((group) => group.name),
      });
      const previewText = joinDigestPreview(title, body);
      const sendResult = await sender.sendDigest(title, body);

      if (!sendResult.ok) {
        return blocked(
          this.options,
          reason === "manual_test"
            ? "Telegram blocked the manual test summary."
            : "Telegram blocked the daily digest.",
          sendResult.detail,
        );
      }

      updateAppConfig((current) => ({
        ...current,
        scheduler: {
          ...current.scheduler,
          lastDigestSentAt: nowIso(),
        },
      }));

      this.options.appendActivity(
        reason === "manual_test" ? "manual_test_sent" : "digest_queued",
        reason === "manual_test"
          ? "Sent manual test summary to Telegram."
          : "Sent digest to Telegram.",
        `${result.runnerId} significance ${result.output.significanceScore}`,
      );

      return {
        status: "success",
        detail: sendResult.detail,
        previewText,
      };
    } catch (error) {
      if (error instanceof RunnerUnavailableError) {
        return blocked(
          this.options,
          "Digest inference runner is unavailable.",
          error.message,
        );
      }

      if (error instanceof RunnerShutdownError) {
        return {
          status: "error",
          detail: "app shutdown",
          previewText: null,
        };
      }

      return blocked(
        this.options,
        "Digest inference or send failed.",
        sanitizeErrorDetail(error),
        "error",
      );
    }
  }

  private async fetchDigestSource(
    source: MessageSource,
    groups: GroupsResponse | null,
    watchedGroupIds: string[],
  ): Promise<DigestSource | { blocked: true; detail: string }> {
    const since = nowUtc().minus({ hours: 24 }).toISO() ?? nowIso();
    const until = nowIso();
    const notes: string[] = [];
    const messages: GatewayMessage[] = [];
    const watchedGroups = watchedGroupIds.map((groupId) => ({
      id: groupId,
      name: getGroupName(groups, groupId),
    }));

    for (const groupId of watchedGroupIds) {
      let cursor: string | null = null;

      do {
        try {
          const response = await source.getGroupMessages(groupId, since, 200, cursor);
          if (!response.complete) {
            return {
              blocked: true,
              detail: `Group ${getGroupName(groups, groupId)} returned incomplete history.`,
            };
          }

          messages.push(...response.messages);
          cursor = response.nextCursor;

          if (messages.length >= 1000) {
            if (cursor || watchedGroupIds[watchedGroupIds.length - 1] !== groupId) {
              notes.push("Digest source truncated to the most recent 1000 messages within 24h.");
            }
            cursor = null;
          }
        } catch (error) {
          return {
            blocked: true,
            detail: error instanceof Error ? error.message : "Failed to fetch digest messages.",
          };
        }
      } while (cursor);
    }

    const sortedMessages = [...messages].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    );
    const boundedMessages = sortedMessages.slice(-1000);

    if (
      sortedMessages.length > 1000 &&
      !notes.includes("Digest source truncated to the most recent 1000 messages within 24h.")
    ) {
      notes.push("Digest source truncated to the most recent 1000 messages within 24h.");
    }

    return {
      watchedGroups,
      messages: boundedMessages,
      notes,
      since,
      until,
    };
  }
}

function blocked(
  options: DigestPipelineOptions,
  summary: string,
  detail: string,
  status: SchedulerRunOutcome["status"] = "blocked",
): SchedulerRunOutcome & { previewText: null } {
  options.appendActivity("digest_blocked", summary, detail);
  return {
    status,
    detail,
    previewText: null,
  };
}

function checkDigestDuplicatePrevention(): { blocked: boolean; detail: string } {
  const config = readAppConfig();

  if (!config.scheduler.lastDigestSentAt) {
    return { blocked: false, detail: "" };
  }

  const minutesAgo = minutesSince(config.scheduler.lastDigestSentAt);
  if (minutesAgo >= 5) {
    return { blocked: false, detail: "" };
  }

  return {
    blocked: true,
    detail: `duplicate prevention - last sent ${minutesAgo}m ago`,
  };
}

function getGroupName(
  groups: GroupsResponse | null,
  groupId: string,
  fallback?: string,
): string {
  return groups?.groups.find((group) => group.id === groupId)?.name ?? fallback ?? groupId;
}

function formatDigestBody(input: {
  summary: string;
  bullets: string[];
  sourceGroups: string[];
}): string {
  const sections = [
    input.summary.trim(),
    input.bullets.length > 0 ? input.bullets.map((bullet) => `- ${bullet}`).join("\n") : "",
    input.sourceGroups.length > 0 ? `Source groups: ${input.sourceGroups.join(", ")}` : "",
  ].filter((value) => value.trim().length > 0);

  return sections.join("\n\n").slice(0, 4000);
}

function joinDigestPreview(title: string, body: string): string {
  return [title.trim(), body.trim()].filter(Boolean).join("\n\n");
}

function buildManualConfirmationMessage(input: { timeZone: string }): string {
  return [
    "Manual summary test completed.",
    `No meaningful messages were found in the last 24 hours as of ${formatLocalTimestamp(
      nowIso(),
      input.timeZone,
    )}.`,
  ].join("\n\n");
}

function sanitizeErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected monitor error.";
}
