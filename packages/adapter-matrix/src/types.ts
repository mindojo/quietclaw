export type MatrixEventContent = {
  body?: string;
  msgtype?: string;
  redacts?: string;
  "m.new_content"?: {
    body?: string;
    msgtype?: string;
  };
  "m.relates_to"?: {
    rel_type?: string;
    event_id?: string;
  };
};

export type MatrixSyncEvent = {
  type: string;
  event_id: string;
  sender: string;
  origin_server_ts: number;
  room_id?: string;
  content?: MatrixEventContent;
  unsigned?: {
    redacted_because?: unknown;
  };
};

export type MatrixRoomMember = {
  state_key: string;
  content?: {
    displayname?: string;
  };
};

export type MatrixSyncResponse = {
  next_batch?: string;
  rooms?: {
    join?: Record<string, {
      timeline?: {
        events?: MatrixSyncEvent[];
      };
    }>;
  };
};

export type MatrixMessagesResponse = {
  chunk?: MatrixSyncEvent[];
};

export type MatrixMembersResponse = {
  chunk?: MatrixRoomMember[];
};
