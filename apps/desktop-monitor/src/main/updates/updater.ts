import { app, autoUpdater } from "electron";

import type { UpdateCheckResult, UpdateState } from "../../preload/api";
import { log } from "../logging";

type UpdateElectronAppModule = {
  UpdateSourceType: {
    ElectronPublicUpdateService: string;
  };
  updateElectronApp(input: {
    updateInterval: string;
    notifyUser: boolean;
    logger: Console;
    updateSource: {
      type: string;
      repo: string;
    };
  }): void;
};

type DesktopAppUpdaterOptions = {
  onStateChanged?: (state: UpdateState) => void;
};

const STARTUP_DELAY_MS = 10_000;
const UPDATE_INTERVAL = "6 hours";
const CHECK_TIMEOUT_MS = 30_000;

function nowIso(): string {
  return new Date().toISOString();
}

function extractAvailableVersion(args: unknown[]): string | null {
  for (const value of args) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value !== "object" || value === null) {
      continue;
    }

    const record = value as Record<string, unknown>;
    const candidates = [record.version, record.releaseName, record.name];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
}

export class DesktopAppUpdater {
  private readonly currentVersion = app.getVersion();
  private readonly repo = resolveUpdateRepo();
  private readonly state: UpdateState = {
    checkedAt: null,
    status: "idle",
    detail: "Update checks have not run yet.",
    currentVersion: this.currentVersion,
    availableVersion: null,
  };
  private configured = false;
  private scheduledStartupCheck: NodeJS.Timeout | null = null;
  private activeCheck: Promise<UpdateCheckResult> | null = null;
  private readonly pendingCheckResolvers = new Set<(state: UpdateCheckResult) => void>();

  constructor(private readonly options: DesktopAppUpdaterOptions = {}) {
    this.bindAutoUpdaterEvents();

    if (!this.canUseAutoUpdates()) {
      this.setState({
        status: "unsupported",
        detail: getUnsupportedDetail(this.repo),
        availableVersion: null,
      });
    }
  }

  initialize(): void {
    if (!this.canUseAutoUpdates() || this.scheduledStartupCheck) {
      return;
    }

    this.scheduledStartupCheck = setTimeout(() => {
      this.scheduledStartupCheck = null;

      if (!this.ensureConfigured()) {
        return;
      }
    }, STARTUP_DELAY_MS);
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (!this.ensureConfigured()) {
      return this.getState();
    }

    if (this.activeCheck) {
      return this.activeCheck;
    }

    const startedAt = nowIso();
    this.setState({
      checkedAt: startedAt,
      status: "checking",
      detail: "Checking GitHub Releases for updates...",
    });

    const waitForTerminalState = new Promise<UpdateCheckResult>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingCheckResolvers.delete(handleStateChange);
        resolve(this.getState());
      }, CHECK_TIMEOUT_MS);

      const handleStateChange = (nextState: UpdateCheckResult): void => {
        if (nextState.status === "checking") {
          return;
        }

        clearTimeout(timeout);
        this.pendingCheckResolvers.delete(handleStateChange);
        resolve(nextState);
      };

      this.pendingCheckResolvers.add(handleStateChange);
    });

    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      this.setState({
        checkedAt: startedAt,
        status: "error",
        detail: formatUpdateError(error),
        availableVersion: null,
      });
    }

    this.activeCheck = waitForTerminalState.finally(() => {
      this.activeCheck = null;
    });

    return this.activeCheck;
  }

  private ensureConfigured(): boolean {
    if (!this.canUseAutoUpdates()) {
      this.setState({
        status: "unsupported",
        detail: getUnsupportedDetail(this.repo),
        availableVersion: null,
      });
      return false;
    }

    if (this.configured) {
      return true;
    }

    try {
      const updaterModule = require("update-electron-app") as UpdateElectronAppModule;

      updaterModule.updateElectronApp({
        updateInterval: UPDATE_INTERVAL,
        notifyUser: true,
        logger: console,
        updateSource: {
          type: updaterModule.UpdateSourceType.ElectronPublicUpdateService,
          repo: this.repo as string,
        },
      });

      this.configured = true;
      this.setState({
        status: this.state.status === "unsupported" ? "idle" : this.state.status,
        detail: "Automatic update checks are enabled.",
      });
      return true;
    } catch (error) {
      const detail = formatUpdateError(error);
      log.error("Failed to configure auto-updates.", error);
      this.setState({
        checkedAt: nowIso(),
        status: "error",
        detail,
        availableVersion: null,
      });
      return false;
    }
  }

  private bindAutoUpdaterEvents(): void {
    autoUpdater.on("checking-for-update", () => {
      this.setState({
        checkedAt: nowIso(),
        status: "checking",
        detail: "Checking GitHub Releases for updates...",
      });
    });

    autoUpdater.on("update-available", (...args: unknown[]) => {
      const availableVersion = extractAvailableVersion(args);
      this.setState({
        checkedAt: nowIso(),
        status: "update-available",
        detail: availableVersion
          ? `Update ${availableVersion} is available and downloading in the background.`
          : "An update is available and downloading in the background.",
        availableVersion,
      });
    });

    autoUpdater.on("update-not-available", () => {
      this.setState({
        checkedAt: nowIso(),
        status: "up-to-date",
        detail: "QuietClaw is up to date.",
        availableVersion: null,
      });
    });

    autoUpdater.on("update-downloaded", (...args: unknown[]) => {
      const availableVersion = extractAvailableVersion(args);
      this.setState({
        checkedAt: nowIso(),
        status: "update-downloaded",
        detail: availableVersion
          ? `Update ${availableVersion} is ready to install. Restart when prompted to finish updating.`
          : "An update is ready to install. Restart when prompted to finish updating.",
        availableVersion,
      });
    });

    autoUpdater.on("error", (error: Error) => {
      log.warn("Auto-update check failed.", error);
      this.setState({
        checkedAt: nowIso(),
        status: "error",
        detail: formatUpdateError(error),
        availableVersion: null,
      });
    });
  }

  private canUseAutoUpdates(): boolean {
    if (process.platform !== "darwin" && process.platform !== "win32") {
      return false;
    }

    if (!app.isPackaged) {
      return false;
    }

    return Boolean(this.repo);
  }

  private setState(next: Partial<UpdateState>): void {
    const merged: UpdateState = {
      ...this.state,
      ...next,
      currentVersion: this.currentVersion,
    };

    this.state.checkedAt = merged.checkedAt;
    this.state.status = merged.status;
    this.state.detail = merged.detail;
    this.state.currentVersion = merged.currentVersion;
    this.state.availableVersion = merged.availableVersion;

    const snapshot = { ...this.state };
    this.options.onStateChanged?.({ ...this.state });
    for (const resolve of this.pendingCheckResolvers) {
      resolve(snapshot);
    }
  }
}

function formatUpdateError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `Update check failed: ${error.message}`;
  }

  return "Update check failed.";
}

function getUnsupportedDetail(repo: string | null): string {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return "Automatic updates are only supported on macOS and Windows.";
  }

  if (!app.isPackaged) {
    return "Automatic updates run only in packaged macOS or Windows builds.";
  }

  if (!repo) {
    return "Set QUIETCLAW_UPDATE_REPO to owner/repo to enable GitHub Releases update checks.";
  }

  return "Automatic updates are unavailable in this build.";
}

function resolveUpdateRepo(): string | null {
  const rawValue = process.env.QUIETCLAW_UPDATE_REPO?.trim();
  return rawValue ? rawValue : null;
}
