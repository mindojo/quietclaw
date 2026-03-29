import type {
  TelegramGetMeResponse,
  TelegramGetUpdatesResponse,
  TelegramUpdate,
  TelegramUser,
} from "./types.js";

export class TelegramApiClient {
  constructor(private readonly token: string) {}

  async getMe(): Promise<TelegramUser> {
    const response = await fetch(this.buildUrl("getMe"));
    const payload = await this.parseJson<TelegramGetMeResponse>(response);

    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.description ?? `Telegram getMe failed with status ${response.status}.`);
    }

    return payload.result;
  }

  async getUpdates(offset?: number, timeout?: number): Promise<TelegramUpdate[]> {
    const url = new URL(this.buildUrl("getUpdates"));
    if (offset !== undefined) {
      url.searchParams.set("offset", String(offset));
    }
    if (timeout !== undefined) {
      url.searchParams.set("timeout", String(timeout));
    }

    const response = await fetch(url);
    const payload = await this.parseJson<TelegramGetUpdatesResponse>(response);

    if (!response.ok || !payload.ok) {
      throw new Error(payload.description ?? `Telegram getUpdates failed with status ${response.status}.`);
    }

    return payload.result ?? [];
  }

  private buildUrl(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  private async parseJson<T>(response: Response): Promise<T> {
    try {
      return await response.json() as T;
    } catch {
      throw new Error(`Telegram API returned invalid JSON for status ${response.status}.`);
    }
  }
}
