export type AdapterCatalogEntry = {
  id: string;
  displayName: string;
  status: "ga" | "beta" | "experimental" | "planned";
  officiality: "official" | "open_protocol" | "community" | "experimental";
  setupComplexity: "low" | "medium" | "high";
  requiresPublicEndpoint: boolean;
  selfHostableForTests: boolean;
  recommendedForMarketing: boolean;
};

export const ADAPTER_CATALOG: AdapterCatalogEntry[] = [
  { id: "telegram", displayName: "Telegram", status: "ga", officiality: "official", setupComplexity: "low", requiresPublicEndpoint: false, selfHostableForTests: false, recommendedForMarketing: true },
  { id: "slack", displayName: "Slack", status: "planned", officiality: "official", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: false, recommendedForMarketing: true },
  { id: "discord", displayName: "Discord", status: "planned", officiality: "official", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: false, recommendedForMarketing: true },
  { id: "matrix", displayName: "Matrix", status: "planned", officiality: "open_protocol", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: true, recommendedForMarketing: true },
  { id: "mattermost", displayName: "Mattermost", status: "planned", officiality: "open_protocol", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: true, recommendedForMarketing: true },
  { id: "zulip", displayName: "Zulip", status: "planned", officiality: "open_protocol", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: true, recommendedForMarketing: true },
  { id: "teams", displayName: "Microsoft Teams", status: "planned", officiality: "official", setupComplexity: "high", requiresPublicEndpoint: true, selfHostableForTests: false, recommendedForMarketing: true },
  { id: "google-chat", displayName: "Google Chat", status: "planned", officiality: "official", setupComplexity: "high", requiresPublicEndpoint: true, selfHostableForTests: false, recommendedForMarketing: true },
  { id: "rocketchat", displayName: "Rocket.Chat", status: "planned", officiality: "open_protocol", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: true, recommendedForMarketing: true },
  { id: "nextcloud-talk", displayName: "Nextcloud Talk", status: "planned", officiality: "open_protocol", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: true, recommendedForMarketing: false },
  { id: "synology-chat", displayName: "Synology Chat", status: "planned", officiality: "open_protocol", setupComplexity: "medium", requiresPublicEndpoint: false, selfHostableForTests: true, recommendedForMarketing: false },
  { id: "feishu", displayName: "Feishu / Lark", status: "planned", officiality: "official", setupComplexity: "medium", requiresPublicEndpoint: true, selfHostableForTests: false, recommendedForMarketing: false },
  { id: "signal", displayName: "Signal", status: "experimental", officiality: "community", setupComplexity: "high", requiresPublicEndpoint: false, selfHostableForTests: false, recommendedForMarketing: false },
];
