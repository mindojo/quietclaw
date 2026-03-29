import type { TelegramBotLike } from "./bot";

export class TelegramSender {
  constructor(private readonly bot: TelegramBotLike, private readonly chatId: number) {}

  isReady(): boolean {
    return Boolean(this.chatId);
  }

  async sendDigest(title: string, body: string): Promise<{ ok: boolean; detail: string }> {
    const text = compactMessage([title.trim(), body.trim()]);
    const result = await this.bot.sendMessage(this.chatId, text);

    return {
      ok: result.ok,
      detail: `Telegram digest sent (${result.messageId}).`,
    };
  }

  async sendUrgent(
    groupName: string,
    senderName: string,
    snippet: string,
    rationale: string,
  ): Promise<{ ok: boolean; detail: string }> {
    const text = compactMessage([
      `Urgent alert from ${groupName}`,
      `${senderName}: ${snippet}`,
      rationale,
    ]);
    const result = await this.bot.sendMessage(this.chatId, text);

    return {
      ok: result.ok,
      detail: `Telegram urgent alert sent (${result.messageId}).`,
    };
  }
}

function compactMessage(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n\n")
    .slice(0, 4000);
}
