import type { GatewayMessage } from "@quietclaw/gateway-contract";

const NOISE_WORDS = new Set([
  "ok",
  "okay",
  "thanks",
  "thank you",
  "thx",
  "got it",
  "done",
  "k",
  "kk",
  "👍",
  "🙏",
  "❤️",
  "תודה",
  "סבבה",
  "אוקיי",
  "מעולה",
  "קיבלתי",
]);

export type MessageLike = Pick<
  GatewayMessage,
  "text" | "caption" | "hasAttachment" | "senderName" | "timestamp"
> & {
  groupName?: string;
};

export type PrefilterResult = {
  skip: boolean;
  reason:
    | "passed"
    | "empty"
    | "short"
    | "symbols_only"
    | "noise";
  meaningfulText: string;
  normalizedText: string;
};

export function extractMeaningfulText(message: Pick<GatewayMessage, "text" | "caption">): string {
  const text = message.text?.trim();

  if (text) {
    return text;
  }

  return message.caption?.trim() ?? "";
}

export function normalizeLooseText(input: string): string {
  return input
    .toLocaleLowerCase()
    .trim()
    .replace(/([\p{P}\p{S}])\1{2,}/gu, "$1$1")
    .replace(/\s+/gu, " ");
}

export function cheapUrgentPrefilter(
  message: Pick<GatewayMessage, "text" | "caption" | "hasAttachment">,
): PrefilterResult {
  const meaningfulText = extractMeaningfulText(message);

  if (!meaningfulText) {
    return {
      skip: true,
      reason: "empty",
      meaningfulText: "",
      normalizedText: "",
    };
  }

  const normalizedText = normalizeLooseText(meaningfulText);

  if (normalizedText.length < 3) {
    return {
      skip: true,
      reason: "short",
      meaningfulText,
      normalizedText,
    };
  }

  if (/^[\p{P}\p{S}\s]+$/u.test(normalizedText)) {
    return {
      skip: true,
      reason: "symbols_only",
      meaningfulText,
      normalizedText,
    };
  }

  if (NOISE_WORDS.has(normalizedText)) {
    return {
      skip: true,
      reason: "noise",
      meaningfulText,
      normalizedText,
    };
  }

  return {
    skip: false,
    reason: "passed",
    meaningfulText,
    normalizedText,
  };
}

export function formatSnippet(value: string | null, limit: number): string {
  const normalized = (value ?? "")
    .replace(/\r?\n+/gu, " / ")
    .replace(/\s+/gu, " ")
    .trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function formatSenderName(senderName: string | null): string {
  return senderName?.trim() || "Unknown sender";
}

export function formatUrgencyContextLine(input: {
  timestamp: string;
  senderName: string | null;
  text: string | null;
  caption: string | null;
}): string {
  const snippet = formatSnippet(
    extractMeaningfulText({
      text: input.text,
      caption: input.caption,
    }),
    240,
  ) || "(no text)";

  return `[${input.timestamp}] ${formatSenderName(input.senderName)}: ${snippet}`;
}

export function formatDigestMessageLine(input: {
  groupName: string;
  timestamp: string;
  senderName: string | null;
  text: string | null;
  caption: string | null;
}): string {
  const snippet = formatSnippet(
    extractMeaningfulText({
      text: input.text,
      caption: input.caption,
    }),
    400,
  ) || "(no text)";

  return `[${input.timestamp}] (${input.groupName}) ${formatSenderName(input.senderName)}: ${snippet}`;
}
