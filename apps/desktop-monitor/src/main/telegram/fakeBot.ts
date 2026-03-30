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
  private readonly getChatResult: { ok: boolean; chatId: number; type?: string } | Error | null;

  constructor(opts: {
    getMeResult?: { ok: boolean; username: string } | Error;
    getChatResult?: { ok: boolean; chatId: number; type?: string } | Error | null;
    updates?: FakeTelegramUpdate[];
  } = {}) {
    this.getMeResult = opts.getMeResult ?? { ok: true, username: "test_bot" };
    this.getChatResult = opts.getChatResult ?? null;
    this.updates = opts.updates ?? [];
  }

  async getMe(): Promise<{ ok: boolean; username: string }> {
    if (this.getMeResult instanceof Error) {
      throw this.getMeResult;
    }

    return this.getMeResult;
  }

  async getChat(chatId: number): Promise<{ ok: boolean; chatId: number; type?: string }> {
    if (this.getChatResult instanceof Error) {
      throw this.getChatResult;
    }

    if (this.getChatResult) {
      return this.getChatResult;
    }

    return {
      ok: true,
      chatId,
      type: "private",
    };
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
