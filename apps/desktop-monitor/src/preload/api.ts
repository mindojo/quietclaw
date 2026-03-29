import type {
  DemoScenario,
  GroupMembersResponse,
  GroupsResponse,
  RunnerPreference,
} from "@quietclaw/gateway-contract";

export type ActivityKind =
  | "daemon_started"
  | "telegram_ready"
  | "telegram_blocked"
  | "gateway_connected"
  | "gateway_disconnected"
  | "gateway_backfilling"
  | "gateway_pairing_required"
  | "monitor_saved"
  | "urgent_detected"
  | "urgent_skipped"
  | "urgent_blocked"
  | "urgent_queued"
  | "digest_started"
  | "digest_blocked"
  | "digest_queued"
  | "digest_empty"
  | "runner_unavailable"
  | "membership_blocked"
  | "manual_test_sent";

export type ActivityEntry = {
  id: string;
  ts: string;
  kind: ActivityKind;
  summary: string;
  detail: string | null;
};

export type TelegramStatus = {
  onboardingState: "not_configured" | "token_entered" | "waiting_for_start" | "ready";
  botUsername: string | null;
  chatId: number | null;
  lastVerifiedAt: string | null;
};

export type DaemonStatus = {
  port: number;
  lastUpdateAt: number | null;
  messageCount: number;
  groupCount: number;
};

export type DesktopMonitorWatchedGroup = {
  groupId: string;
  dailySummary: boolean;
  forwardUrgent: boolean;
};

export type DesktopMonitorConfig = {
  enabled: boolean;
  watchedGroups: DesktopMonitorWatchedGroup[];
  digestTimeLocal: string;
  digestTimezone: string;
  runnerPreference: RunnerPreference;
  urgentCooldownMinutes: number;
  updatedAt: string | null;
};

export type DesktopMonitorUpsert = DesktopMonitorConfig;

export type PromptTemplateConfig = {
  template: string;
  isCustom: boolean;
};

export type PromptTemplates = {
  summary: PromptTemplateConfig;
  urgent: PromptTemplateConfig;
};

export type BootstrapState = {
  legal: {
    accepted: boolean;
    acceptedVersion: string | null;
    acceptedAt: string | null;
  };
  settings: AppSettingsView;
  monitor: DesktopMonitorConfig;
  activity: ActivityEntry[];
  groups: GroupsResponse | null;
  telegramStatus: TelegramStatus;
  daemonStatus: DaemonStatus;
};

export type TelegramTokenResult = {
  ok: boolean;
  error?: string;
};

export type AiProviderAuthStatus = {
  loggedIn: boolean;
  detail: string;
};

export type AiProviderDetection = {
  claude: boolean;
  codex: boolean;
  claudeAuth: AiProviderAuthStatus;
  codexAuth: AiProviderAuthStatus;
};

export type TestTelegramResult = {
  ok: boolean;
  detail: string;
};

export type AiTestResult = {
  ok: boolean;
  provider: string;
  model: string;
  responseTimeMs: number;
  prompt: string;
  response: string;
  error: string | null;
};

export type ManualRunResult = {
  ok: boolean;
  blocked: boolean;
  detail: string;
  previewText: string | null;
};

export type RunnerStatus = {
  id: RunnerPreference;
  label: string;
  available: boolean;
  detail: string | null;
  selected: boolean;
};

export type AppSettingsView = {
  appVersion: string;
  legal: {
    accepted: boolean;
    acceptedVersion: string | null;
    acceptedAt: string | null;
  };
  runnerPreference: RunnerPreference;
  updates: UpdateState;
  ui: {
    startAtLogin: boolean;
    updateChannel: "stable";
    settingsOpen: boolean;
  };
};

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "update-available"
  | "update-downloaded"
  | "error"
  | "unsupported";

export type UpdateState = {
  checkedAt: string | null;
  status: UpdateStatus;
  detail: string;
  currentVersion: string;
  availableVersion: string | null;
};

export type SaveSettingsInput = Partial<{
  runnerPreference: RunnerPreference;
  startAtLogin: boolean;
  updateChannel: "stable";
  settingsOpen: boolean;
}>;

export type UpdateCheckResult = UpdateState;

export type ExportDiagnosticsResult = {
  saved: boolean;
  path: string | null;
  detail: string;
};

export type RendererSubscriptionEvent =
  | {
      type: "activity-appended";
      entry: ActivityEntry;
    }
  | { type: "bootstrap-changed" }
  | {
      type: "daemon-status-changed";
      status: DaemonStatus;
    }
  | {
      type: "group-catalog-updated";
      groups: GroupsResponse | null;
    }
  | { type: "monitor-changed" }
  | { type: "settings-changed" }
  | {
      type: "telegram-status-changed";
      status: TelegramStatus;
    };

type MonitorAppBridge = {
  invoke<TResult>(channel: string, ...args: unknown[]): Promise<TResult>;
  subscribe(listener: (event: RendererSubscriptionEvent) => void): () => void;
};

export type MonitorAppApi = {
  getBootstrapState(): Promise<BootstrapState>;
  acceptLegal(version: string): Promise<void>;

  detectAiProviders(): Promise<AiProviderDetection>;
  testAiConnection(): Promise<AiTestResult>;
  setTelegramBotToken(token: string): Promise<TelegramTokenResult>;
  resetConnections(): Promise<{ ok: boolean }>;
  resetEverything(): Promise<void>;
  resetTelegramConnection(): Promise<{ ok: boolean }>;
  sendTestTelegramMessage(): Promise<TestTelegramResult>;
  getTelegramStatus(): Promise<TelegramStatus>;
  getDaemonStatus(): Promise<DaemonStatus>;
  getGroups(): Promise<GroupsResponse | null>;
  getGroupMembers(groupId: string): Promise<GroupMembersResponse>;
  hideGroup(groupId: string): Promise<void>;
  openExternal(url: string): Promise<void>;

  getMonitor(): Promise<DesktopMonitorConfig>;
  getPromptTemplates(): Promise<PromptTemplates>;
  saveMonitor(input: DesktopMonitorUpsert): Promise<DesktopMonitorConfig>;
  savePromptTemplate(
    kind: "summary" | "urgent",
    template: string,
  ): Promise<{ ok: boolean; isCustom: boolean }>;
  resetPromptTemplate(kind: "summary" | "urgent"): Promise<{ ok: boolean; template: string }>;
  sendTestSummary(): Promise<ManualRunResult>;

  getRunnerStatus(): Promise<RunnerStatus[]>;
  getActivity(): Promise<ActivityEntry[]>;
  clearActivity(): Promise<void>;

  listDemoScenarios(): Promise<DemoScenario[]>;
  runDemoScenario(id: string): Promise<{ accepted: boolean; detail: string }>;
  resetDemo(): Promise<{ ok: boolean; detail: string }>;

  getSettings(): Promise<AppSettingsView>;
  saveSettings(input: SaveSettingsInput): Promise<AppSettingsView>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  exportDiagnostics(): Promise<ExportDiagnosticsResult>;

  subscribe(listener: (event: RendererSubscriptionEvent) => void): () => void;
};

export function createMonitorAppApi(bridge: MonitorAppBridge): MonitorAppApi {
  return {
    getBootstrapState: () => bridge.invoke("app:getBootstrapState"),
    acceptLegal: (version) => bridge.invoke("app:acceptLegal", version),
    detectAiProviders: () => bridge.invoke("app:detectAiProviders"),
    testAiConnection: () => bridge.invoke("app:testAiConnection"),
    setTelegramBotToken: (token) => bridge.invoke("app:setTelegramBotToken", token),
    resetConnections: () => bridge.invoke("app:resetConnections"),
    resetEverything: () => bridge.invoke("app:resetEverything"),
    resetTelegramConnection: () => bridge.invoke("app:resetTelegramConnection"),
    sendTestTelegramMessage: () => bridge.invoke("app:sendTestTelegramMessage"),
    getTelegramStatus: () => bridge.invoke("app:getTelegramStatus"),
    getDaemonStatus: () => bridge.invoke("app:getDaemonStatus"),
    getGroups: () => bridge.invoke("app:getGroups"),
    getGroupMembers: (groupId) => bridge.invoke("app:getGroupMembers", groupId),
    hideGroup: (groupId) => bridge.invoke("app:hideGroup", groupId),
    openExternal: (url) => bridge.invoke("app:openExternal", url),
    getMonitor: () => bridge.invoke("app:getMonitor"),
    getPromptTemplates: () => bridge.invoke("app:getPromptTemplates"),
    saveMonitor: (input) => bridge.invoke("app:saveMonitor", input),
    savePromptTemplate: (kind, template) =>
      bridge.invoke("app:savePromptTemplate", kind, template),
    resetPromptTemplate: (kind) => bridge.invoke("app:resetPromptTemplate", kind),
    sendTestSummary: () => bridge.invoke("app:sendTestSummary"),
    getRunnerStatus: () => bridge.invoke("app:getRunnerStatus"),
    getActivity: () => bridge.invoke("app:getActivity"),
    clearActivity: () => bridge.invoke("app:clearActivity"),
    listDemoScenarios: () => bridge.invoke("app:listDemoScenarios"),
    runDemoScenario: (id) => bridge.invoke("app:runDemoScenario", id),
    resetDemo: () => bridge.invoke("app:resetDemo"),
    getSettings: () => bridge.invoke("app:getSettings"),
    saveSettings: (input) => bridge.invoke("app:saveSettings", input),
    checkForUpdates: () => bridge.invoke("app:checkForUpdates"),
    exportDiagnostics: () => bridge.invoke("app:exportDiagnostics"),
    subscribe: (listener) => bridge.subscribe(listener),
  };
}

declare global {
  interface Window {
    monitorApp: MonitorAppApi;
  }
}
