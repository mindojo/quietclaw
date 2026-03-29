import { formatDigestMessageLine, formatUrgencyContextLine } from "./normalization";
import type { DigestPromptInput, UrgencyPromptInput } from "./runnerManager";

const URGENCY_PROMPT_LIMIT_BYTES = 16 * 1024;
const DIGEST_PROMPT_LIMIT_BYTES = 64 * 1024;

function safeValue(value: string | null): string {
  return value?.trim() || "(none)";
}

function bytes(input: string): number {
  return Buffer.byteLength(input, "utf8");
}

export function buildUrgencyPrompt(input: UrgencyPromptInput): string {
  const recentContextLines = input.recentContext.map((entry) => formatUrgencyContextLine(entry));

  const render = (lines: string[]): string => `You are reviewing messages from a chat group that a user chose to monitor locally.

Your job is to decide whether the triggering message likely requires prompt human attention.
Be conservative:
- Ignore casual chat, jokes, reactions, thanks, emojis, and normal conversation.
- Focus on urgent logistics, safety, medical, security, or clear schedule changes that likely matter soon.
- If unsure, prefer urgent=false.

Return JSON only, matching the provided schema.

Context:
- Source group: ${input.watchedGroupName}
- Target group: ${input.targetGroupName}
- Trigger timestamp (UTC): ${input.timestamp}

Trigger message:
- Sender: ${safeValue(input.triggerMessage.senderName)}
- Text: ${safeValue(input.triggerMessage.text)}
- Caption: ${safeValue(input.triggerMessage.caption)}
- Has attachment: ${String(input.triggerMessage.hasAttachment)}
- Attachment kind: ${safeValue(input.triggerMessage.attachmentKind)}

Recent context (oldest to newest):
${lines.length > 0 ? lines.join("\n") : "(no recent context)"}

Decision rules:
1. urgent=true only when a reasonable person would likely want a prompt alert.
2. confidence must be between 0 and 1.
3. rationale must be short and concrete.
4. suggestedMessage should be concise and ready to send into the target group if urgent=true.
5. If urgent=false, suggestedMessage must be null.
`;

  let prompt = render(recentContextLines);

  while (bytes(prompt) > URGENCY_PROMPT_LIMIT_BYTES && recentContextLines.length > 0) {
    recentContextLines.shift();
    prompt = render(recentContextLines);
  }

  return prompt;
}

export function buildDigestPrompt(input: DigestPromptInput): string {
  const messageLines = input.messages.map((message) => formatDigestMessageLine(message));
  const notes = [...input.notes];

  const render = (lines: string[], extraNotes: string[]): string => `You are summarizing the last 24 hours of messages from one or more monitored chat groups.

The summary will be forwarded into a single target group.
Be concise, readable, and factual.
Ignore casual noise, repeated acknowledgements, emojis, and low-information chatter.
Highlight schedule changes, deadlines, payments, maintenance, school notices, medical items, security concerns, and decisions that seem useful to preserve.

Return JSON only, matching the provided schema.

Context:
- Target group: ${input.targetGroupName}
- Watched groups: ${input.watchedGroups.map((group) => group.name).join(", ")}
- Window start (UTC): ${input.since}
- Window end (UTC): ${input.until}

${extraNotes.length > 0 ? `Notes:\n${extraNotes.map((note) => `- ${note}`).join("\n")}\n\n` : ""}Messages (chronological):
${lines.length > 0 ? lines.join("\n") : "(no messages)"}

Decision rules:
1. shouldSend=true only if the last 24 hours contain enough useful information to justify a forwarded digest.
2. significanceScore must be 0..100.
3. title should be short.
4. summary should be clear and compact.
5. bullets should contain the most important takeaways.
6. rationale should explain briefly why the digest should or should not be sent.
`;

  let prompt = render(messageLines, notes);

  while (bytes(prompt) > DIGEST_PROMPT_LIMIT_BYTES && messageLines.length > 0) {
    messageLines.shift();

    if (!notes.includes("Some older messages were omitted to fit the summarization budget.")) {
      notes.push("Some older messages were omitted to fit the summarization budget.");
    }

    prompt = render(messageLines, notes);
  }

  return prompt;
}
