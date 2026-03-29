import type {
  SlackAuthTestResponse,
  SlackConversation,
  SlackConversationsListResponse,
  SlackHistoryResponse,
  SlackMessageEvent,
  SlackSocketModeResponse,
} from "./types.js";

export class SlackApiClient {
  constructor(private readonly token: string, private readonly appToken: string) {}

  async authTest(): Promise<SlackAuthTestResponse> {
    return this.postForm<SlackAuthTestResponse>("https://slack.com/api/auth.test");
  }

  async openSocketModeConnection(): Promise<string> {
    const payload = await this.postForm<SlackSocketModeResponse>("https://slack.com/api/apps.connections.open", undefined, true);

    if (!payload.ok || !payload.url) {
      throw new Error(payload.error ?? "Slack Socket Mode connection failed.");
    }

    return payload.url;
  }

  async listConversations(cursor?: string): Promise<SlackConversation[]> {
    const payload = await this.postForm<SlackConversationsListResponse>(
      "https://slack.com/api/conversations.list",
      {
        exclude_archived: "true",
        limit: "200",
        types: "public_channel,private_channel,mpim",
        ...(cursor ? { cursor } : {}),
      },
    );

    if (!payload.ok) {
      throw new Error(payload.error ?? "Slack conversations.list failed.");
    }

    return payload.channels ?? [];
  }

  async getConversationHistory(channel: string, limit = 100): Promise<SlackMessageEvent[]> {
    const payload = await this.postForm<SlackHistoryResponse>("https://slack.com/api/conversations.history", {
      channel,
      limit: String(limit),
    });

    if (!payload.ok) {
      throw new Error(payload.error ?? "Slack conversations.history failed.");
    }

    return payload.messages ?? [];
  }

  private async postForm<T>(
    url: string,
    body?: Record<string, string>,
    useAppToken = false,
  ): Promise<T> {
    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${useAppToken ? this.appToken : this.token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    };
    if (body) {
      init.body = new URLSearchParams(body).toString();
    }

    const response = await fetch(url, init);

    try {
      return await response.json() as T;
    } catch {
      throw new Error(`Slack API returned invalid JSON for status ${response.status}.`);
    }
  }
}
