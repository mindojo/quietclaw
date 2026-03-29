export type DiscordGatewayInfo = {
  url: string;
};

export class DiscordApiClient {
  constructor(private readonly token: string) {}

  async getGateway(): Promise<DiscordGatewayInfo> {
    const response = await fetch("https://discord.com/api/v10/gateway/bot", {
      headers: {
        Authorization: `Bot ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Discord gateway request failed with status ${response.status}.`);
    }

    try {
      const payload = await response.json() as DiscordGatewayInfo;
      if (!payload.url) {
        throw new Error("Discord gateway URL missing.");
      }

      return payload;
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Discord API returned invalid JSON for status ${response.status}.`);
    }
  }
}
