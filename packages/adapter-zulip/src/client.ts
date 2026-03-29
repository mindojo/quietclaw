import type {
  ZulipEvent,
  ZulipEventsResponse,
  ZulipMessage,
  ZulipMessagesResponse,
  ZulipRegisterResponse,
} from "./types.js";

export class ZulipApiClient {
  constructor(
    private readonly serverUrl: string,
    private readonly email: string,
    private readonly apiKey: string,
  ) {}

  async registerQueue(): Promise<Required<Pick<ZulipRegisterResponse, "queue_id" | "last_event_id">>> {
    const payload = await this.requestJson<ZulipRegisterResponse>("/api/v1/register", {
      method: "POST",
      body: new URLSearchParams({
        event_types: JSON.stringify(["message", "update_message", "delete_message"]),
      }),
    });

    if (!payload.queue_id || payload.last_event_id === undefined) {
      throw new Error("Zulip queue registration failed.");
    }

    return {
      queue_id: payload.queue_id,
      last_event_id: payload.last_event_id,
    };
  }

  async getEvents(queueId: string, lastEventId: number): Promise<ZulipEvent[]> {
    const url = `/api/v1/events?queue_id=${encodeURIComponent(queueId)}&last_event_id=${lastEventId}&dont_block=false`;
    const payload = await this.requestJson<ZulipEventsResponse>(url);

    return payload.events ?? [];
  }

  async getMessages(limit = 100): Promise<ZulipMessage[]> {
    const anchor = "newest";
    const narrow = JSON.stringify([]);
    const url = `/api/v1/messages?anchor=${encodeURIComponent(anchor)}&num_before=${limit}&num_after=0&narrow=${encodeURIComponent(narrow)}`;
    const payload = await this.requestJson<ZulipMessagesResponse>(url);

    return payload.messages ?? [];
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.serverUrl), {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.email}:${this.apiKey}`).toString("base64")}`,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Zulip API request failed with status ${response.status}.`);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new Error(`Zulip API returned invalid JSON for status ${response.status}.`);
    }
  }
}
