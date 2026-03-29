import type {
  MatrixMembersResponse,
  MatrixMessagesResponse,
  MatrixRoomMember,
  MatrixSyncEvent,
  MatrixSyncResponse,
} from "./types.js";

export class MatrixApiClient {
  constructor(
    private readonly homeserverUrl: string,
    private readonly accessToken: string,
  ) {}

  async sync(since?: string, timeout = 30_000): Promise<MatrixSyncResponse> {
    const url = new URL("/_matrix/client/v3/sync", this.homeserverUrl);
    url.searchParams.set("timeout", String(timeout));
    if (since) {
      url.searchParams.set("since", since);
    }
    return this.getJson<MatrixSyncResponse>(url);
  }

  async getRoomMessages(roomId: string, limit = 100): Promise<MatrixSyncEvent[]> {
    const url = new URL(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages`, this.homeserverUrl);
    url.searchParams.set("dir", "b");
    url.searchParams.set("limit", String(limit));
    const payload = await this.getJson<MatrixMessagesResponse>(url);

    return payload.chunk ?? [];
  }

  async getRoomMembers(roomId: string): Promise<MatrixRoomMember[]> {
    const url = new URL(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members`, this.homeserverUrl);
    const payload = await this.getJson<MatrixMembersResponse>(url);

    return payload.chunk ?? [];
  }

  private async getJson<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Matrix API request failed with status ${response.status}.`);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new Error(`Matrix API returned invalid JSON for status ${response.status}.`);
    }
  }
}
