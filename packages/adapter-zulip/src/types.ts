export type ZulipMessage = {
  id: number;
  stream_id?: number;
  stream_name?: string;
  topic?: string;
  sender_id: number;
  sender_email?: string;
  sender_full_name?: string;
  sender_short_name?: string;
  sender_is_bot?: boolean;
  content?: string;
  content_type?: string;
  timestamp: number;
};

export type ZulipMessageEvent = {
  type: "message";
  message: ZulipMessage;
};

export type ZulipUpdateMessageEvent = {
  type: "update_message";
  message_id: number;
  stream_id?: number;
  stream_name?: string;
  topic?: string;
  sender_id?: number;
  sender_email?: string;
  sender_full_name?: string;
  rendered_content?: string;
  content?: string;
  edit_timestamp: number;
};

export type ZulipDeleteMessageEvent = {
  type: "delete_message";
  message_id: number;
  stream_id?: number;
  stream_name?: string;
  topic?: string;
};

export type ZulipEvent = ZulipMessageEvent | ZulipUpdateMessageEvent | ZulipDeleteMessageEvent;

export type ZulipRegisterResponse = {
  queue_id?: string;
  last_event_id?: number;
};

export type ZulipEventsResponse = {
  events?: ZulipEvent[];
};

export type ZulipMessagesResponse = {
  messages?: ZulipMessage[];
};
