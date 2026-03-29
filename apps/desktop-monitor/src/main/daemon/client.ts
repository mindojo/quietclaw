import type { GroupsResponse, GroupMessagesResponse } from "@quietclaw/gateway-contract";

type DaemonStateLike = {
  getGroups(): GroupsResponse;
  getMessages(params: {
    groupId: string;
    since: string;
    limit: number;
    cursor: string | null;
  }): GroupMessagesResponse | null;
};

export class DaemonClient {
  constructor(private readonly state: DaemonStateLike) {}

  async getGroups(): Promise<GroupsResponse> {
    return this.state.getGroups();
  }

  async getGroupMessages(
    groupId: string,
    since: string,
    limit = 200,
    cursor: string | null = null,
  ): Promise<GroupMessagesResponse> {
    const response = this.state.getMessages({
      groupId,
      since,
      limit,
      cursor,
    });

    if (!response) {
      throw new Error(`Group ${groupId} is unavailable from the daemon.`);
    }

    return response;
  }
}
