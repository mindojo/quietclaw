import type { GatewayMessage } from "@quietclaw/gateway-contract";

export function pruneExpiredMessages(
  messages: GatewayMessage[],
  now: Date,
  retentionHours: number,
): GatewayMessage[] {
  const cutoffMs = now.getTime() - retentionHours * 60 * 60 * 1000;

  return messages.filter((message) => {
    return new Date(message.timestamp).getTime() >= cutoffMs;
  });
}
