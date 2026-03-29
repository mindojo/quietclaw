import { exec } from "node:child_process";
import os from "node:os";

import { app } from "electron";
import type { GroupMembersResponse, GroupsResponse } from "@quietclaw/gateway-contract";

import type {
  ActivityEntry,
  AppSettingsView,
  BootstrapState,
  RendererSubscriptionEvent,
  UpdateCheckResult,
} from "../../preload/api";
import { getAppStore, readAppConfig, updateAppConfig } from "../config/store";
import type { ActivityKind } from "../config/schema";
import { DaemonClient } from "../daemon/client";
import { DaemonManager } from "../daemon/manager";
import { log } from "../logging";
import { MonitorEngine, type OutboundSender } from "../monitors/engine";
import { FakeTelegramSender } from "../telegram/fakeSender";
import { telegramConfigStore, TelegramOnboarding } from "../telegram/onboarding";
import { TelegramSender } from "../telegram/sender";
import type { DesktopAppUpdater } from "../updates/updater";

type AppRuntimeOptions = {
  emit: (event: RendererSubscriptionEvent) => void;
  updater: DesktopAppUpdater;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export class DesktopAppRuntime {
  private readonly daemonManager = new DaemonManager();
  private readonly monitorEngine: MonitorEngine;
  private readonly telegramOnboarding: TelegramOnboarding;
  private outboundSender: OutboundSender | null;
  private daemonClient: DaemonClient | null = null;
  private groups: GroupsResponse | null = null;
  private daemonUnsubscribers: Array<() => void> = [];

  constructor(private readonly options: AppRuntimeOptions) {
    this.outboundSender = process.env.QUIETCLAW_FAKE_OUTBOUND === "1"
      ? new FakeTelegramSender()
      : null;
    this.telegramOnboarding = new TelegramOnboarding(
      (state, detail) => {
        // Guard: skip if called during construction before assignment completes
        if (!this.telegramOnboarding) {
          return;
        }

        if (state === "ready") {
          this.appendActivity(
            "telegram_ready",
            detail.botUsername
              ? `Telegram ready via @${detail.botUsername}.`
              : "Telegram is ready.",
            detail.chatId ? `chat ${detail.chatId}` : null,
          );
        }

        this.refreshOutboundSender();

        this.options.emit({
          type: "telegram-status-changed",
          status: this.getTelegramStatus(),
        });
      },
      telegramConfigStore,
    );
    this.refreshOutboundSender();

    this.monitorEngine = new MonitorEngine({
      appendActivity: (kind, summary, detail) => {
        this.appendActivity(kind, summary, detail);
      },
      getGroups: () => this.groups,
      getMessageSource: () => this.daemonClient,
      getOutboundSender: () => this.getTelegramSender(),
    });
  }

  async initialize(): Promise<void> {
    // Resolve the user's full shell PATH early so CLI tools (claude, codex)
    // are discoverable from Electron's sandboxed environment.
    const { resolveUserShellPath } = await import("../util/shellPath.js");
    await resolveUserShellPath();

    const config = readAppConfig();
    app.setLoginItemSettings({
      openAtLogin: config.ui.startAtLogin,
    });

    const daemonStarted = await this.daemonManager.start();
    updateAppConfig((current) => ({
      ...current,
      daemon: {
        ...current.daemon,
        port: daemonStarted.port,
      },
    }));

    const daemonState = this.daemonManager.getState();
    this.daemonClient = new DaemonClient(daemonState);
    this.groups = await this.daemonClient.getGroups();
    this.daemonUnsubscribers = [
      daemonState.onObservedMessage((payload) => {
        this.daemonManager.onMessageReceived();
        this.options.emit({
          type: "daemon-status-changed",
          status: this.getDaemonStatus(),
        });
        void this.monitorEngine.handleMessageReceived(payload).catch((error) => {
          log.warn("Failed to process observed daemon message.", error);
        });
      }),
      daemonState.onGroupCatalogUpdated((groups) => {
        this.groups = groups;
        this.options.emit({ type: "group-catalog-updated", groups });
        this.options.emit({
          type: "daemon-status-changed",
          status: this.getDaemonStatus(),
        });
      }),
    ];

    this.appendActivity(
      "daemon_started",
      `Live daemon listening on port ${daemonStarted.port}.`,
      null,
    );

    this.monitorEngine.start();
  }

  async shutdown(): Promise<void> {
    for (const unsubscribe of this.daemonUnsubscribers) {
      unsubscribe();
    }
    this.daemonUnsubscribers = [];
    this.telegramOnboarding.destroy();
    await this.monitorEngine.shutdown();
    await this.daemonManager.stop();
  }

  getBootstrapState(): BootstrapState {
    const config = readAppConfig();

    return {
      legal: config.legal,
      settings: this.getSettingsView(),
      monitor: config.monitor,
      activity: config.activity.entries,
      groups: this.groups,
      telegramStatus: this.getTelegramStatus(),
      daemonStatus: this.getDaemonStatus(),
    };
  }

  getSettingsView(): AppSettingsView {
    let config = readAppConfig();
    const loginItemSettings = app.getLoginItemSettings();

    if (config.ui.startAtLogin !== loginItemSettings.openAtLogin) {
      config = updateAppConfig((current) => ({
        ...current,
        ui: {
          ...current.ui,
          startAtLogin: loginItemSettings.openAtLogin,
        },
      }));
    }

    return {
      appVersion: app.getVersion(),
      legal: config.legal,
      runnerPreference: config.monitor.runnerPreference,
      updates: this.options.updater.getState(),
      ui: config.ui,
    };
  }

  async setTelegramBotToken(token: string): Promise<{ ok: boolean; error?: string }> {
    const result = await this.telegramOnboarding.setBotToken(token);

    if (!result.ok) {
      this.appendActivity(
        "telegram_blocked",
        "Telegram bot verification failed.",
        result.error ?? "verification failed",
      );
      return result;
    }

    this.options.emit({
      type: "telegram-status-changed",
      status: this.getTelegramStatus(),
    });
    return result;
  }

  getTelegramStatus(): BootstrapState["telegramStatus"] {
    const config = readAppConfig().telegram;
    const status = this.telegramOnboarding.getStatus();

    return {
      onboardingState: status.state,
      botUsername: status.botUsername,
      chatId: status.chatId,
      lastVerifiedAt: config.lastVerifiedAt,
    };
  }

  getDaemonStatus(): BootstrapState["daemonStatus"] {
    return this.daemonManager.getStatus();
  }

  async getGroups(): Promise<GroupsResponse | null> {
    if (!this.daemonClient) {
      return null;
    }

    this.groups = await this.daemonClient.getGroups();
    return this.groups;
  }

  async getGroupMembers(groupId: string): Promise<GroupMembersResponse> {
    const members = this.daemonManager.getState().getGroupMembers(groupId);
    if (!members) {
      throw new Error("Group is no longer available from the daemon.");
    }

    return members;
  }

  async hideGroup(groupId: string): Promise<void> {
    this.daemonManager.getState().hideGroup(groupId);
    this.groups = this.daemonManager.getState().getGroups();
    this.options.emit({ type: "group-catalog-updated", groups: this.groups });
    this.options.emit({
      type: "daemon-status-changed",
      status: this.getDaemonStatus(),
    });
  }

  async getRunnerStatus() {
    return this.monitorEngine.getRunnerStatus();
  }

  async sendTestSummary() {
    return this.monitorEngine.runManualTestSummary();
  }

  async sendTestTelegramMessage(): Promise<{ ok: boolean; detail: string }> {
    const status = this.telegramOnboarding.getStatus();
    const bot = this.telegramOnboarding.getBot();

    if (status.state !== "ready" || status.chatId === null || !bot) {
      return { ok: false, detail: "Telegram is not ready." };
    }

    try {
      await bot.sendMessage(status.chatId, "Hello from QuietClaw! ✅ Your bot is working.");
      return { ok: true, detail: "Message sent." };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "Send failed.",
      };
    }
  }

  async testAiConnection(): Promise<{
    ok: boolean;
    provider: string;
    model: string;
    responseTimeMs: number;
    prompt: string;
    response: string;
    error: string | null;
  }> {
    const { spawn } = await import("node:child_process");
    const { getResolvedPath } = await import("../util/shellPath.js");
    const config = readAppConfig();
    const runner = config.monitor.runnerPreference;
    const prompt = 'Is this message urgent? Reply URGENT or NOT_URGENT and a one-line reason. Message: "The building water will be shut off in 10 minutes."';
    const start = Date.now();

    let command: string;
    let args: string[];
    let providerLabel: string;
    let modelLabel: string;

    if (runner === "codex") {
      command = "codex";
      // --ephemeral: no session persistence
      // --skip-git-repo-check: no git repo required
      // -c 'mcp_servers={}': don't load any MCP servers
      args = ["exec", "--ephemeral", "--skip-git-repo-check", "-c", "mcp_servers={}", prompt];
      providerLabel = "Codex CLI";
      modelLabel = "gpt-5.4";
    } else {
      command = "claude";
      // --no-session-persistence: don't save session to disk
      // CWD is set to /tmp below to avoid project scanning and macOS TCC dialogs
      args = ["-p", "--model", "haiku", "--no-session-persistence", prompt];
      providerLabel = "Claude Code";
      modelLabel = "haiku";
    }

    try {
      const resolvedPath = getResolvedPath();
      const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, {
          env: { ...process.env, PATH: resolvedPath },
          // "ignore" stdin so Claude doesn't wait for input
          stdio: ["ignore", "pipe", "pipe"],
          // CWD /tmp avoids project scanning / macOS TCC dialogs
          cwd: os.tmpdir(),
          timeout: 60_000,
        });

        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];

        child.stdout.on("data", (data: Buffer) => chunks.push(data));
        child.stderr.on("data", (data: Buffer) => errChunks.push(data));

        child.on("close", (code) => {
          const out = Buffer.concat(chunks).toString().trim();
          const err = Buffer.concat(errChunks).toString().trim();

          if (code !== 0 && out.length === 0) {
            reject(new Error(err || `Process exited with code ${code}`));
            return;
          }

          resolve({ stdout: out, stderr: err });
        });

        child.on("error", (err) => {
          reject(err);
        });
      });

      return {
        ok: true,
        provider: providerLabel,
        model: modelLabel,
        responseTimeMs: Date.now() - start,
        prompt,
        response: stdout.slice(0, 500),
        error: null,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        ok: false,
        provider: providerLabel,
        model: modelLabel,
        responseTimeMs: Date.now() - start,
        prompt,
        response: "",
        error: errorMsg,
      };
    }
  }

  async resetConnections(): Promise<{ ok: boolean }> {
    this.telegramOnboarding.reset();
    updateAppConfig((config) => ({
      ...config,
      telegram: {
        encryptedBotToken: null,
        botUsername: null,
        chatId: null,
        onboardingState: "not_configured",
        lastVerifiedAt: null,
      },
      monitor: {
        ...config.monitor,
        runnerPreference: "auto",
      },
    }));
    this.refreshOutboundSender();
    this.options.emit({ type: "bootstrap-changed" });
    return { ok: true };
  }

  async resetEverything(): Promise<void> {
    const store = getAppStore();
    store.clear();
    app.relaunch();
    app.quit();
  }

  async resetTelegramConnection(): Promise<{ ok: boolean }> {
    this.telegramOnboarding.reset();
    this.refreshOutboundSender();
    this.options.emit({ type: "bootstrap-changed" });
    return { ok: true };
  }

  async listDemoScenarios(): Promise<{ scenarios: [] }> {
    return { scenarios: [] };
  }

  async runDemoScenario(_id: string): Promise<{ accepted: boolean; detail: string }> {
    return {
      accepted: false,
      detail: "Demo scenarios are unavailable in live daemon mode.",
    };
  }

  async resetDemo(): Promise<{ ok: boolean; detail: string }> {
    return {
      ok: false,
      detail: "Demo reset is unavailable in live daemon mode.",
    };
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    return this.options.updater.checkForUpdates();
  }

  private getTelegramSender(): OutboundSender | null {
    return this.outboundSender;
  }

  private refreshOutboundSender(): void {
    if (process.env.QUIETCLAW_FAKE_OUTBOUND === "1") {
      this.outboundSender ??= new FakeTelegramSender();
      return;
    }

    const status = this.telegramOnboarding.getStatus();
    const bot = this.telegramOnboarding.getBot();

    this.outboundSender = bot && status.chatId !== null
      ? new TelegramSender(bot, status.chatId)
      : null;
  }

  private appendActivity(
    kind: ActivityKind,
    summary: string,
    detail: string | null,
  ): ActivityEntry {
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

    this.options.emit({ type: "activity-appended", entry });
    return entry;
  }
}

export function createDesktopAppRuntime(options: AppRuntimeOptions): DesktopAppRuntime {
  return new DesktopAppRuntime(options);
}
