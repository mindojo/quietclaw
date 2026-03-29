export type MattermostUser = {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
};

export type MattermostChannel = {
  id: string;
  display_name?: string;
  name?: string;
  type?: "O" | "P" | "D" | "G";
};

export type MattermostPost = {
  id: string;
  channel_id: string;
  user_id: string;
  message?: string;
  create_at: number;
  edit_at?: number;
  delete_at?: number;
  root_id?: string;
};

export type MattermostSocketEvent = {
  event: "posted" | "post_edited" | "post_deleted";
  data?: {
    channel_type?: MattermostChannel["type"];
    post?: string;
  };
  broadcast?: {
    channel_id?: string;
  };
};
