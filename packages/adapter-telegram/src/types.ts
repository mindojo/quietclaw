export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  edit_date?: number;
  reply_to_message?: { message_id: number };
  photo?: unknown[];
  video?: unknown;
  document?: unknown;
  audio?: unknown;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

export type TelegramGetMeResponse = {
  ok: boolean;
  result?: TelegramUser;
  description?: string;
};

export type TelegramGetUpdatesResponse = {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
};
