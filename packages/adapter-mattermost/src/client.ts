import type { MattermostChannel, MattermostPost, MattermostUser } from "./types.js";

export class MattermostApiClient {
  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
  ) {}

  getAccessToken(): string {
    return this.token;
  }

  async getMe(): Promise<MattermostUser> {
    return this.getJson<MattermostUser>("/api/v4/users/me");
  }

  async listChannels(): Promise<MattermostChannel[]> {
    return this.getJson<MattermostChannel[]>("/api/v4/channels");
  }

  async listPosts(channelId: string, perPage = 100): Promise<MattermostPost[]> {
    const payload = await this.getJson<{ posts?: Record<string, MattermostPost>; order?: string[] }>(
      `/api/v4/channels/${channelId}/posts?page=0&per_page=${perPage}`,
    );

    const order = payload.order ?? [];
    const posts = payload.posts ?? {};

    return order.map((postId) => posts[postId]).filter((post): post is MattermostPost => post !== undefined);
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(new URL(path, this.serverUrl), {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Mattermost API request failed with status ${response.status}.`);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new Error(`Mattermost API returned invalid JSON for status ${response.status}.`);
    }
  }
}
