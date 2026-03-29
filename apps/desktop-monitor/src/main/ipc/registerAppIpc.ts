import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { exec } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { GroupsResponse } from "@quietclaw/gateway-contract";
import { IANAZone } from "luxon";

import type {
  ActivityEntry,
  AppSettingsView,
  DesktopMonitorConfig,
  DesktopMonitorUpsert,
  ExportDiagnosticsResult,
  LegalAcceptanceRecord,
  LegalDocumentId,
  ManualRunResult,
  RendererSubscriptionEvent,
  SaveSettingsInput,
} from "../../preload/api";
import {
  DEFAULT_SUMMARY_TEMPLATE,
  DEFAULT_URGENT_TEMPLATE,
} from "../config/promptDefaults.js";
import {
  LEGAL_BUNDLE_VERSION,
  LegalAcceptanceRecordSchema,
} from "../config/schema";
import { readAppConfig, updateAppConfig } from "../config/store";
import { log } from "../logging";
import type { DesktopAppRuntime } from "../startup/bootstrap";
import { IPC_CHANNELS } from "./channels";

let isRegistered = false;
const DIGEST_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const rendererEventBus = {
  emit(event: RendererSubscriptionEvent): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.subscriptionEvent, event);
      }
    }
  },
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function appendActivity(
  kind: ActivityEntry["kind"],
  summary: string,
  detail: string | null,
): void {
  const entry: ActivityEntry = {
    id: createId(),
    ts: nowIso(),
    kind,
    summary,
    detail,
  };

  updateAppConfig((config) => ({
    ...config,
    activity: {
      ...config.activity,
      entries: [entry, ...config.activity.entries].slice(0, 1000),
    },
  }));

  rendererEventBus.emit({ type: "activity-appended", entry });
}

function validateMonitor(
  input: DesktopMonitorUpsert,
  groups: GroupsResponse,
): DesktopMonitorConfig {
  const telegramReady = readAppConfig().telegram.onboardingState === "ready";
  const watchedGroups = input.watchedGroups.filter(
    (entry) => entry.dailySummary || entry.forwardUrgent,
  );

  if (!telegramReady) {
    throw new Error("Finish Telegram setup before saving monitor settings.");
  }

  if (watchedGroups.length === 0) {
    throw new Error("Select at least one watched group.");
  }

  if (
    watchedGroups.some((entry) => entry.dailySummary) &&
    !DIGEST_TIME_PATTERN.test(input.digestTimeLocal)
  ) {
    throw new Error("Digest time must be set in HH:mm format.");
  }

  if (!IANAZone.isValidZone(input.digestTimezone)) {
    throw new Error("Digest timezone must be a valid IANA timezone.");
  }

  if (
    !Number.isInteger(input.urgentCooldownMinutes) ||
    input.urgentCooldownMinutes < 1 ||
    input.urgentCooldownMinutes > 180
  ) {
    throw new Error("Urgent cooldown must be between 1 and 180 minutes.");
  }

  const groupsById = new Map(groups.groups.map((group) => [group.id, group]));
  const missingWatchedGroups = watchedGroups.filter((entry) => !groupsById.has(entry.groupId));
  if (missingWatchedGroups.length > 0) {
    throw new Error("One or more watched groups are no longer available from the daemon.");
  }

  return {
    ...input,
    enabled: true,
    watchedGroups,
    updatedAt: nowIso(),
  };
}

async function handleSaveSettings(
  input: SaveSettingsInput,
  runtime: DesktopAppRuntime,
): Promise<AppSettingsView> {
  updateAppConfig((config) => ({
    ...config,
    monitor: {
      ...config.monitor,
      runnerPreference: input.runnerPreference ?? config.monitor.runnerPreference,
    },
    ui: {
      ...config.ui,
      startAtLogin: input.startAtLogin ?? config.ui.startAtLogin,
      updateChannel: input.updateChannel ?? config.ui.updateChannel,
      settingsOpen: input.settingsOpen ?? config.ui.settingsOpen,
    },
    legal: {
      ...config.legal,
      optionalChoices: {
        analyticsOptIn: input.analyticsOptIn ?? config.legal.optionalChoices.analyticsOptIn,
        crashPrepOptIn: input.crashPrepOptIn ?? config.legal.optionalChoices.crashPrepOptIn,
      },
    },
  }));

  if (typeof input.startAtLogin === "boolean") {
    app.setLoginItemSettings({
      openAtLogin: input.startAtLogin,
    });
  }

  rendererEventBus.emit({ type: "settings-changed" });
  return runtime.getSettingsView();
}

async function handleSendTestSummary(runtime: DesktopAppRuntime): Promise<ManualRunResult> {
  return runtime.sendTestSummary();
}

async function handleExportDiagnostics(
  runtime: DesktopAppRuntime,
): Promise<ExportDiagnosticsResult> {
  const config = readAppConfig();
  const settings = runtime.getSettingsView();
  const groups = await runtime.getGroups();
  const runnerStatus = (await runtime.getRunnerStatus()).map((entry) => ({
    id: entry.id,
    label: entry.label,
    available: entry.available,
    selected: entry.selected,
    detail: entry.detail,
  }));

  const diagnostics = {
    appVersion: app.getVersion(),
    os: {
      platform: process.platform,
      version: os.version(),
      release: os.release(),
      arch: process.arch,
    },
    runnerStatus,
    monitor: sanitizeMonitorConfig(config.monitor, groups),
    daemon: runtime.getDaemonStatus(),
    telegram: runtime.getTelegramStatus(),
    activity: sanitizeActivityEntries(config.activity.entries.slice(0, 100)),
  };

  const defaultPath = path.join(
    app.getPath("documents"),
    `quietclaw-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (result.canceled || !result.filePath) {
    return {
      saved: false,
      path: null,
      detail: "Diagnostics export cancelled.",
    };
  }

  await fs.writeFile(result.filePath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");

  return {
    saved: true,
    path: result.filePath,
    detail: "Diagnostics exported.",
  };
}

function sanitizeMonitorConfig(monitor: DesktopMonitorConfig, groups: GroupsResponse | null) {
  const groupsById = new Map((groups?.groups ?? []).map((group) => [group.id, group]));

  return {
    enabled: monitor.enabled,
    watchedGroups: monitor.watchedGroups.map((entry) => ({
      groupId: entry.groupId,
      groupName: groupsById.get(entry.groupId)?.name ?? null,
      available: groupsById.has(entry.groupId),
      dailySummary: entry.dailySummary,
      forwardUrgent: entry.forwardUrgent,
    })),
    digestTimeLocal: monitor.digestTimeLocal,
    digestTimezone: monitor.digestTimezone,
    runnerPreference: monitor.runnerPreference,
    urgentCooldownMinutes: monitor.urgentCooldownMinutes,
    updatedAt: monitor.updatedAt,
  };
}

function sanitizeActivityEntries(entries: ActivityEntry[]) {
  return entries.map((entry) => ({
    id: entry.id,
    ts: entry.ts,
    kind: entry.kind,
    summary: entry.summary,
    hasDetail: Boolean(entry.detail),
  }));
}

function resolveLegalDocumentPath(documentId: LegalDocumentId): string {
  const candidateRoots = [
    process.cwd(),
    app.getAppPath(),
    path.resolve(app.getAppPath(), ".."),
    path.resolve(app.getAppPath(), "..", ".."),
  ];

  for (const root of candidateRoots) {
    const candidate = path.resolve(root, "docs/legal", documentId);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate legal document: ${documentId}`);
}

export function registerAppIpc(runtime: DesktopAppRuntime): void {
  if (isRegistered) {
    return;
  }

  ipcMain.handle(IPC_CHANNELS.getBootstrapState, async () => runtime.getBootstrapState());
  ipcMain.handle(IPC_CHANNELS.acceptLegal, async (_event, record: LegalAcceptanceRecord) => {
    const acceptedRecord = LegalAcceptanceRecordSchema.parse({
      ...record,
      legalBundleVersion: record.legalBundleVersion ?? LEGAL_BUNDLE_VERSION,
    });

    updateAppConfig((config) => ({
      ...config,
      legal: acceptedRecord,
    }));

    rendererEventBus.emit({ type: "bootstrap-changed" });
    rendererEventBus.emit({ type: "settings-changed" });

    return acceptedRecord;
  });
  ipcMain.handle(IPC_CHANNELS.detectAiProviders, async () => {
    const { shellExecOptions } = await import("../util/shellPath.js");
    const which = process.platform === "win32" ? "where" : "which";

    const checkInstalled = (cmd: string): Promise<boolean> =>
      new Promise((resolve) => {
        exec(`${which} ${cmd}`, shellExecOptions(), (error) => resolve(!error));
      });

    const checkClaudeAuth = (): Promise<{ loggedIn: boolean; detail: string }> =>
      new Promise((resolve) => {
        exec("claude auth status", shellExecOptions({ timeout: 10_000 }), (error, stdout) => {
          if (error) {
            resolve({ loggedIn: false, detail: "Not authenticated" });
            return;
          }
          try {
            const parsed = JSON.parse(stdout.toString()) as { loggedIn?: boolean; email?: string; subscriptionType?: string };
            if (parsed.loggedIn) {
              const info = [parsed.email, parsed.subscriptionType].filter(Boolean).join(" · ");
              resolve({ loggedIn: true, detail: info || "Authenticated" });
            } else {
              resolve({ loggedIn: false, detail: "Not logged in" });
            }
          } catch {
            // Non-JSON output — check if stdout contains something useful
            const out = stdout.toString().trim();
            resolve({ loggedIn: out.length > 0, detail: out.slice(0, 100) || "Unknown status" });
          }
        });
      });

    const checkCodexAuth = (): Promise<{ loggedIn: boolean; detail: string }> =>
      new Promise((resolve) => {
        exec("codex login status", shellExecOptions({ timeout: 10_000 }), (error, stdout) => {
          if (error) {
            resolve({ loggedIn: false, detail: "Not authenticated" });
            return;
          }
          const out = stdout.toString().trim();
          const loggedIn = out.toLowerCase().includes("logged in");
          resolve({ loggedIn, detail: out.slice(0, 100) || "Unknown status" });
        });
      });

    const [claudeInstalled, codexInstalled] = await Promise.all([
      checkInstalled("claude"),
      checkInstalled("codex"),
    ]);

    const [claudeAuth, codexAuth] = await Promise.all([
      claudeInstalled ? checkClaudeAuth() : Promise.resolve({ loggedIn: false, detail: "Not installed" }),
      codexInstalled ? checkCodexAuth() : Promise.resolve({ loggedIn: false, detail: "Not installed" }),
    ]);

    return {
      claude: claudeInstalled,
      codex: codexInstalled,
      claudeAuth,
      codexAuth,
    };
  });
  ipcMain.handle(IPC_CHANNELS.setTelegramBotToken, async (_event, token: string) =>
    runtime.setTelegramBotToken(token),
  );
  ipcMain.handle(IPC_CHANNELS.sendTestTelegramMessage, async () =>
    runtime.sendTestTelegramMessage(),
  );
  ipcMain.handle(IPC_CHANNELS.testAiConnection, async () =>
    runtime.testAiConnection(),
  );
  ipcMain.handle(IPC_CHANNELS.resetConnections, async () =>
    runtime.resetConnections(),
  );
  ipcMain.handle(IPC_CHANNELS.resetEverything, async () =>
    runtime.resetEverything(),
  );
  ipcMain.handle(IPC_CHANNELS.resetTelegramConnection, async () =>
    runtime.resetTelegramConnection(),
  );
  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: string) => {
    // Only allow https:// and tg:// URLs for security
    if (url.startsWith("https://") || url.startsWith("tg://")) {
      await shell.openExternal(url);
    }
  });
  ipcMain.handle(IPC_CHANNELS.openLegalDocument, async (_event, documentId: LegalDocumentId) => {
    const result = await shell.openPath(resolveLegalDocumentPath(documentId));
    if (result) {
      throw new Error(result);
    }
  });
  ipcMain.handle(IPC_CHANNELS.getTelegramStatus, async () => runtime.getTelegramStatus());
  ipcMain.handle(IPC_CHANNELS.getDaemonStatus, async () => runtime.getDaemonStatus());
  ipcMain.handle(IPC_CHANNELS.getGroups, async () => runtime.getGroups());
  ipcMain.handle(IPC_CHANNELS.getGroupMembers, async (_event, groupId: string) =>
    runtime.getGroupMembers(groupId),
  );
  ipcMain.handle(IPC_CHANNELS.hideGroup, async (_event, groupId: string) =>
    runtime.hideGroup(groupId),
  );
  ipcMain.handle(IPC_CHANNELS.getMonitor, async () => readAppConfig().monitor);
  ipcMain.handle(IPC_CHANNELS.getPromptTemplates, async () => readAppConfig().promptTemplates);
  ipcMain.handle(
    IPC_CHANNELS.savePromptTemplate,
    async (_event, kind: "summary" | "urgent", template: string) => {
      const defaultTemplate = kind === "summary"
        ? DEFAULT_SUMMARY_TEMPLATE
        : DEFAULT_URGENT_TEMPLATE;
      const isCustom = template.trim() !== defaultTemplate.trim();
      updateAppConfig((config) => ({
        ...config,
        promptTemplates: {
          ...config.promptTemplates,
          [kind]: { template, isCustom },
        },
      }));
      return { ok: true, isCustom };
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.resetPromptTemplate,
    async (_event, kind: "summary" | "urgent") => {
      const defaultTemplate = kind === "summary"
        ? DEFAULT_SUMMARY_TEMPLATE
        : DEFAULT_URGENT_TEMPLATE;
      updateAppConfig((config) => ({
        ...config,
        promptTemplates: {
          ...config.promptTemplates,
          [kind]: { template: defaultTemplate, isCustom: false },
        },
      }));
      return { ok: true, template: defaultTemplate };
    },
  );
  ipcMain.handle(IPC_CHANNELS.saveMonitor, async (_event, input) => {
    const currentGroups = await runtime.getGroups();

    if (!currentGroups) {
      throw new Error("Wait for the daemon to start before saving monitor settings.");
    }

    const nextMonitor = validateMonitor(input, currentGroups);

    updateAppConfig((config) => ({
      ...config,
      monitor: nextMonitor,
    }));
    appendActivity("monitor_saved", "Monitor settings saved.", null);
    rendererEventBus.emit({ type: "monitor-changed" });

    return nextMonitor;
  });
  ipcMain.handle(IPC_CHANNELS.sendTestSummary, async () => handleSendTestSummary(runtime));
  ipcMain.handle(IPC_CHANNELS.getRunnerStatus, async () => runtime.getRunnerStatus());
  ipcMain.handle(IPC_CHANNELS.getActivity, async () => readAppConfig().activity.entries);
  ipcMain.handle(IPC_CHANNELS.clearActivity, async () => {
    updateAppConfig((config) => ({
      ...config,
      activity: {
        ...config.activity,
        entries: [],
      },
    }));
    rendererEventBus.emit({ type: "bootstrap-changed" });
  });
  ipcMain.handle(IPC_CHANNELS.listDemoScenarios, async () => {
    const scenarios = await runtime.listDemoScenarios();
    return scenarios.scenarios;
  });
  ipcMain.handle(IPC_CHANNELS.runDemoScenario, async (_event, id: string) =>
    runtime.runDemoScenario(id),
  );
  ipcMain.handle(IPC_CHANNELS.resetDemo, async () => runtime.resetDemo());
  ipcMain.handle(IPC_CHANNELS.getSettings, async () => runtime.getSettingsView());
  ipcMain.handle(IPC_CHANNELS.saveSettings, async (_event, input) =>
    handleSaveSettings(input, runtime),
  );
  ipcMain.handle(IPC_CHANNELS.checkForUpdates, async () => runtime.checkForUpdates());
  ipcMain.handle(IPC_CHANNELS.exportDiagnostics, async () => handleExportDiagnostics(runtime));

  isRegistered = true;
  log.info("IPC handlers registered.");
}
