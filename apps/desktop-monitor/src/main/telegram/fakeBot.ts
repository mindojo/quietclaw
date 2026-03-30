import type { TelegramBotLike } from "./bot";

export type FakeTelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number; type?: string };
    text?: string;
  };
};

export class FakeTelegramBot implements TelegramBotLike {
  private updates: FakeTelegramUpdate[];
  private readonly getMeResult: { ok: boolean; username: string } | Error;

  constructor(opts: {
    getMeResult?: { ok: boolean; username: string } | Error;
    updates?: FakeTelegramUpdate[];
  } = {}) {
    this.getMeResult = opts.getMeResult ?? { ok: true, username: "test_bot" };
    this.updates = opts.updates ?? [];
  }

  async getMe(): Promise<{ ok: boolean; username: string }> {
    if (this.getMeResult instanceof Error) {
      throw this.getMeResult;
    }

    return this.getMeResult;
  }

  async getUpdates(offset?: number): Promise<FakeTelegramUpdate[]> {
    return this.updates.filter((update) => offset === undefined || update.update_id >= offset);
  }

  async sendMessage(
    _chatId: number,
    _text: string,
    _parseMode?: "MarkdownV2" | "HTML",
  ): Promise<{ ok: boolean; messageId: number }> {
    return { ok: true, messageId: Date.now() };
  }

  pushUpdate(update: FakeTelegramUpdate): void {
    this.updates.push(update);
  }
}
