export type SlackConversation = {
  id: string;
  name?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
};

export type SlackMessageEvent = {
  type: string;
  channel: string;
  ts: string;
  user?: string;
  text?: string;
  subtype?: string;
  hidden?: boolean;
  deleted_ts?: string;
  channel_type?: "channel" | "group" | "im" | "mpim";
  message?: {
    type?: "message";
    channel?: string;
    ts?: string;
    user?: string;
    text?: string;
    edited?: { user?: string; ts?: string };
  };
  previous_message?: {
    ts?: string;
    user?: string;
    text?: string;
  };
};

export type SlackSocketEnvelope = {
  type: "hello" | "disconnect" | "events_api";
  envelope_id?: string;
  payload?: {
    event?: SlackMessageEvent;
  };
};

export type SlackAuthTestResponse = {
  ok: boolean;
  user_id?: string;
  error?: string;
};

export type SlackConversationsListResponse = {
  ok: boolean;
  channels?: SlackConversation[];
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
};

export type SlackHistoryResponse = {
  ok: boolean;
  messages?: SlackMessageEvent[];
  error?: string;
};

export type SlackSocketModeResponse = {
  ok: boolean;
  url?: string;
  error?: string;
};
