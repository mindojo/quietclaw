import type { NormalizedEventEnvelope } from "@quietclaw/ingest-contract";

import type { MattermostChannel, MattermostPost, MattermostSocketEvent, MattermostUser } from "./types.js";

type MattermostMapperOptions = {
  channel?: MattermostChannel;
  post?: MattermostPost;
  user?: MattermostUser;
};

function resolveDisplayName(user: MattermostUser | undefined): string | null {
  if (!user) {
    return null;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName.length > 0 ? fullName : user.username;
}

function resolveConversationKind(channelType: MattermostChannel["type"] | undefined): "channel" | "group" {
  return channelType === "P" || channelType === "G" ? "group" : "channel";
}

export function mapMattermostEventToEnvelope(
  event: MattermostSocketEvent,
  adapterVersion: string,
  options: MattermostMapperOptions = {},
): NormalizedEventEnvelope | null {
  const rawPost = event.data?.post;
  const parsedPost = rawPost ? JSON.parse(rawPost) as MattermostPost : undefined;
  const post = options.post ?? parsedPost;

  if (!post) {
    return null;
  }

  let eventType: "message.created" | "message.updated" | "message.deleted";
  if (event.event === "posted") {
    eventType = "message.created";
  } else if (event.event === "post_edited") {
    eventType = "message.updated";
  } else if (event.event === "post_deleted") {
    eventType = "message.deleted";
  } else {
    return null;
  }

  if (!post.message && eventType !== "message.deleted") {
    return null;
  }

  const channelId = post.channel_id ?? event.broadcast?.channel_id;
  if (!channelId) {
    return null;
  }

  const channelType = options.channel?.type ?? event.data?.channel_type;

  return {
    schemaVersion: "1.0",
    adapter: {
      id: "mattermost",
      version: adapterVersion,
      officiality: "open_protocol",
    },
    delivery: {
      mode: "websocket",
      eventType,
      eventId: `mattermost:${event.event}:${post.id}`,
      occurredAt: new Date((post.edit_at && post.edit_at > 0 ? post.edit_at : post.create_at)).toISOString(),
      observedAt: new Date().toISOString(),
      isBackfill: false,
    },
    conversation: {
      id: `mattermost:${channelId}`,
      nativeId: channelId,
      kind: resolveConversationKind(channelType),
      displayName: options.channel?.display_name ?? options.channel?.name ?? null,
      tenantId: null,
      threadId: post.root_id ? `mattermost:${post.root_id}` : null,
    },
    actor: {
      id: `mattermost:${post.user_id}`,
      nativeId: post.user_id,
      displayName: resolveDisplayName(options.user),
      handle: options.user?.username ?? null,
      isBot: options.user?.is_bot ?? false,
    },
    message: {
      id: `mattermost:${post.id}`,
      nativeId: post.id,
      text: eventType === "message.deleted" ? null : post.message ?? null,
      html: null,
      attachments: [],
      replyToMessageId: post.root_id ? `mattermost:${post.root_id}` : null,
      edited: eventType === "message.updated",
      languageHint: null,
    },
    capabilities: {
      history: "full",
      membership: "full",
    },
    sourceMeta: {
      rawType: event.event,
      channelType: channelType ?? null,
    },
  };
}
