export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string;
  bot?: boolean;
};

export type DiscordMessage = {
  id: string;
  channel_id: string;
  guild_id?: string;
  content?: string;
  author?: DiscordUser;
  timestamp: string;
  edited_timestamp?: string | null;
  type?: number;
};

export type DiscordMessageDeleteEvent = {
  id: string;
  channel_id: string;
  guild_id?: string;
};

export type DiscordGatewayDispatch<T> = {
  op: number;
  t?: string;
  s?: number;
  d: T;
};

export type DiscordGatewayHello = {
  heartbeat_interval: number;
};
