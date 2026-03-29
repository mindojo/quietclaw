import type {
  DigestDecision,
  UrgencyDecision,
} from "@quietclaw/gateway-contract";

import {
  extractMeaningfulText,
  formatSenderName,
  formatSnippet,
  normalizeLooseText,
} from "../normalization";
import type {
  DigestPromptInput,
  MonitorInferenceRunner,
  RunnerAvailability,
  RunnerResult,
  UrgencyPromptInput,
} from "../runnerManager";

const URGENT_KEYWORDS = [
  "urgent",
  "asap",
  "immediately",
  "now",
  "cancelled",
  "canceled",
  "change of plan",
  "pickup now",
  "medical",
  "ambulance",
  "security",
  "locked out",
  "police",
  "דחוף",
  "מייד",
  "עכשיו",
  "ביטול",
  "שינוי",
  "אמבולנס",
  "משטרה",
  "רפואי",
] as const;

const MEDICAL_KEYWORDS = ["medical", "ambulance", "רפואי", "אמבולנס"] as const;
const SECURITY_KEYWORDS = ["security", "locked out", "police", "משטרה"] as const;
const SCHEDULE_KEYWORDS = [
  "cancelled",
  "canceled",
  "change of plan",
  "ביטול",
  "שינוי",
] as const;
const LOGISTICS_KEYWORDS = ["pickup now", "now", "עכשיו"] as const;
const DIGEST_KEYWORDS = [
  "schedule",
  "change",
  "meeting",
  "deadline",
  "payment",
  "school",
  "building",
  "maintenance",
  "medical",
  "meeting",
  "cancelled",
  "canceled",
  "ביטול",
  "שינוי",
  "תשלום",
  "בית ספר",
  "רפואי",
] as const;

export class DemoRunner implements MonitorInferenceRunner {
  readonly id = "demo" as const;

  async checkAvailability(): Promise<RunnerAvailability> {
    return {
      available: true,
      detail: "Built-in deterministic runner available.",
    };
  }

  async runUrgency(
    input: UrgencyPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<UrgencyDecision>> {
    signal.throwIfAborted?.();
    const startedAt = Date.now();
    const normalized = normalizeLooseText(
      input.triggerMessage.text?.trim() || input.triggerMessage.caption?.trim() || "",
    );
    const matchedKeyword = URGENT_KEYWORDS.find((keyword) => normalized.includes(keyword));
    const urgent = Boolean(matchedKeyword);
    const category = classifyUrgencyCategory(normalized);
    const confidence = urgent
      ? isObviousUrgencyKeyword(matchedKeyword ?? "") ? 0.92 : 0.8
      : 0.2;
    const rationale = urgent
      ? buildUrgencyRationale(category, matchedKeyword ?? "urgent wording")
      : "No clear urgent signal was found in the triggering message.";
    const snippet = formatSnippet(
      input.triggerMessage.text?.trim() || input.triggerMessage.caption?.trim() || "",
      240,
    );

    return {
      runnerId: this.id,
      rawDurationMs: Date.now() - startedAt,
      output: {
        urgent,
        confidence,
        category,
        rationale,
        suggestedMessage: urgent
          ? `⚠️ Urgent item detected in ${input.watchedGroupName}.\n\n${formatSenderName(input.triggerMessage.senderName)} wrote:\n"${snippet || "(no text)"}"\n\nWhy it may need attention: ${rationale}`
          : null,
      },
    };
  }

  async runDigest(
    input: DigestPromptInput,
    signal: AbortSignal,
  ): Promise<RunnerResult<DigestDecision>> {
    signal.throwIfAborted?.();
    const startedAt = Date.now();
    const meaningfulMessages = input.messages.filter((message) =>
      extractMeaningfulText({
        text: message.text,
        caption: message.caption,
      }),
    );
    const keywordHits = meaningfulMessages.reduce((count, message) => {
      const normalized = normalizeLooseText(
        extractMeaningfulText({
          text: message.text,
          caption: message.caption,
        }),
      );

      return count + DIGEST_KEYWORDS.filter((keyword) => normalized.includes(keyword)).length;
    }, 0);
    const significanceScore = Math.min(
      100,
      meaningfulMessages.length * 12 + keywordHits * 9,
    );
    const shouldSend = meaningfulMessages.length >= 4 || significanceScore >= 55;
    const groupNames = [...new Set(input.messages.map((message) => message.groupName))];
    const highlightedMessages = meaningfulMessages.slice(-3);
    const attachmentCount = meaningfulMessages.filter((message) => message.hasAttachment).length;
    const bullets = highlightedMessages.slice(0, 6).map((message) => {
      const snippet = formatSnippet(
        extractMeaningfulText({
          text: message.text,
          caption: message.caption,
        }),
        140,
      );

      return `${message.groupName}: ${formatSenderName(message.senderName)} mentioned ${snippet}.`;
    });
    const summaryParts = [
      `${meaningfulMessages.length} meaningful updates across ${groupNames.join(", ")}.`,
      keywordHits > 0
        ? `High-signal topics included ${describeDigestTopics(meaningfulMessages)}.`
        : "Most activity was routine chat with limited long-term value.",
      attachmentCount > 0
        ? `${attachmentCount} captioned attachment messages were included.`
        : "",
    ].filter(Boolean);

    return {
      runnerId: this.id,
      rawDurationMs: Date.now() - startedAt,
      output: {
        shouldSend: meaningfulMessages.length >= 2 ? shouldSend : false,
        significanceScore,
        title: shouldSend
          ? buildDigestTitle(meaningfulMessages)
          : "Low-signal daily digest",
        summary: meaningfulMessages.length >= 2
          ? summaryParts.join("\n\n")
          : "Fewer than two meaningful messages remained after filtering, so no digest should be sent.",
        bullets: meaningfulMessages.length >= 2 ? bullets : [],
        rationale: meaningfulMessages.length >= 2
          ? shouldSend
            ? "Message count and keyword weight met the deterministic digest threshold."
            : "The last 24 hours had some signal, but not enough to justify a forwarded digest."
          : "Not enough meaningful messages remained after filtering.",
      },
    };
  }
}

function classifyUrgencyCategory(normalizedText: string): UrgencyDecision["category"] {
  if (MEDICAL_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
    return "medical";
  }

  if (SECURITY_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
    return "security";
  }

  if (SCHEDULE_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
    return "schedule_change";
  }

  if (LOGISTICS_KEYWORDS.some((keyword) => normalizedText.includes(keyword))) {
    return "logistics";
  }

  return "other";
}

function isObviousUrgencyKeyword(keyword: string): boolean {
  return ![
    "cancelled",
    "canceled",
    "change of plan",
    "pickup now",
    "ביטול",
    "שינוי",
  ].includes(keyword);
}

function buildUrgencyRationale(
  category: UrgencyDecision["category"],
  keyword: string,
): string {
  switch (category) {
    case "medical":
      return `Medical wording matched "${keyword}".`;
    case "security":
      return `Security-related wording matched "${keyword}".`;
    case "schedule_change":
      return `A near-term schedule change matched "${keyword}".`;
    case "logistics":
      return `Time-sensitive logistics matched "${keyword}".`;
    default:
      return `Urgent wording matched "${keyword}".`;
  }
}

function buildDigestTitle(messages: DigestPromptInput["messages"]): string {
  const normalizedCorpus = messages
    .map((message) =>
      normalizeLooseText(
        extractMeaningfulText({
          text: message.text,
          caption: message.caption,
        }),
      ),
    )
    .join(" ");

  if (SCHEDULE_KEYWORDS.some((keyword) => normalizedCorpus.includes(keyword))) {
    return "Schedule and plan updates";
  }

  if (MEDICAL_KEYWORDS.some((keyword) => normalizedCorpus.includes(keyword))) {
    return "Medical-related updates";
  }

  if (SECURITY_KEYWORDS.some((keyword) => normalizedCorpus.includes(keyword))) {
    return "Security-related updates";
  }

  return "Daily monitored group digest";
}

function describeDigestTopics(messages: DigestPromptInput["messages"]): string {
  const topicLabels = new Set<string>();

  for (const message of messages) {
    const normalized = normalizeLooseText(
      extractMeaningfulText({
        text: message.text,
        caption: message.caption,
      }),
    );

    if (SCHEDULE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      topicLabels.add("schedule changes");
    }

    if (normalized.includes("meeting")) {
      topicLabels.add("meetings");
    }

    if (normalized.includes("deadline")) {
      topicLabels.add("deadlines");
    }

    if (normalized.includes("payment") || normalized.includes("תשלום")) {
      topicLabels.add("payments");
    }

    if (normalized.includes("school") || normalized.includes("בית ספר")) {
      topicLabels.add("school notices");
    }

    if (normalized.includes("building") || normalized.includes("maintenance")) {
      topicLabels.add("maintenance");
    }

    if (MEDICAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      topicLabels.add("medical items");
    }
  }

  return [...topicLabels].join(", ") || "routine coordination";
}
