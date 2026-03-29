type TelegramGetMeResponse = {
  ok: boolean;
  result?: {
    username?: string;
  };
  description?: string;
};

type TelegramGetUpdatesResponse = {
  ok: boolean;
  result?: Array<{
    update_id: number;
    message?: {
      chat?: {
        id: number;
      };
      text?: string;
    };
  }>;
  description?: string;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
};

export interface TelegramBotLike {
  getMe(): Promise<{ ok: boolean; username: string }>;
  getUpdates(
    offset?: number,
  ): Promise<Array<{ update_id: number; message?: { chat: { id: number }; text?: string } }>>;
  sendMessage(
    chatId: number,
    text: string,
    parseMode?: "MarkdownV2" | "HTML",
  ): Promise<{ ok: boolean; messageId: number }>;
}

export class TelegramBot implements TelegramBotLike {
  constructor(private readonly token: string) {}

  async getMe(): Promise<{ ok: boolean; username: string }> {
    const response = await fetch(this.getUrl("getMe"));
    const payload = await this.readJson<TelegramGetMeResponse>(response);

    if (!response.ok || !payload.ok || !payload.result?.username) {
      throw new Error(payload.description ?? "Telegram bot verification failed.");
    }

    return {
      ok: true,
      username: payload.result.username,
    };
  }

  async getUpdates(
    offset?: number,
  ): Promise<Array<{ update_id: number; message?: { chat: { id: number }; text?: string } }>> {
    const params = new URLSearchParams({
      timeout: "5",
    });

    if (typeof offset === "number") {
      params.set("offset", String(offset));
    }

    const response = await fetch(`${this.getUrl("getUpdates")}?${params.toString()}`);
    const payload = await this.readJson<TelegramGetUpdatesResponse>(response);

    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? "Telegram update polling failed.");
    }

    return (payload.result ?? []).filter(
      (
        update,
      ): update is { update_id: number; message?: { chat: { id: number }; text?: string } } =>
        typeof update.update_id === "number",
    );
  }

  async sendMessage(
    chatId: number,
    text: string,
    parseMode?: "MarkdownV2" | "HTML",
  ): Promise<{ ok: boolean; messageId: number }> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(this.getUrl("sendMessage"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(parseMode ? { parse_mode: parseMode } : {}),
        }),
      });

      if (response.status === 429 && attempt === 0) {
        const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") ?? "1", 10);
        const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 1000;
        await wait(waitMs);
        continue;
      }

      const payload = await this.readJson<TelegramSendMessageResponse>(response);
      if (!response.ok || !payload.ok || typeof payload.result?.message_id !== "number") {
        throw new Error(payload.description ?? "Telegram send failed.");
      }

      return {
        ok: true,
        messageId: payload.result.message_id,
      };
    }

    throw new Error("Telegram send failed after retry.");
  }

  private getUrl(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  private async readJson<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
