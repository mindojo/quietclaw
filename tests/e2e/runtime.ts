import fs from "node:fs";
import path from "node:path";
import { ChildProcess, spawn } from "node:child_process";

export const PROJECT_ROOT = path.resolve(__dirname, "../..");
const APP_OUT_DIR = path.resolve(PROJECT_ROOT, "apps/desktop-monitor/out");
const TSX_CLI_PATH = path.resolve(PROJECT_ROOT, "node_modules/tsx/dist/cli.mjs");
const CONFIG_FILE_NAME = "desktop-monitor-config.json";
const LEGAL_BUNDLE_VERSION = "2026-03-29.1";

type AppConfig = {
  schemaVersion: 1;
  legal: {
    legalBundleVersion: string | null;
    appVersion: string | null;
    acceptedAt: string | null;
    locale: string | null;
    platform: string | null;
    docs: {
      termsVersion: string | null;
      privacyVersion: string | null;
      riskDisclosureVersion: string | null;
      retentionNoticeVersion: string | null;
    };
    requiredChecks: {
      acceptedTerms: boolean;
      acknowledgedPrivacy: boolean;
      acknowledgedRisk: boolean;
      acknowledgedRetentionCaveat: boolean;
    };
    optionalChoices: {
      analyticsOptIn: boolean;
      crashPrepOptIn: boolean;
    };
    providerConsents: Array<{
      providerId: string;
      providerNoticeVersion: string;
      acceptedAt: string;
    }>;
  };
  telegram: {
    encryptedBotToken: string | null;
    botUsername: string | null;
    chatId: number | null;
    onboardingState: "not_configured" | "token_entered" | "waiting_for_start" | "ready";
    lastVerifiedAt: string | null;
  };
  daemon: {
    port: number;
  };
  monitor: {
    enabled: boolean;
    watchedGroups: Array<{
      groupId: string;
      dailySummary: boolean;
      forwardUrgent: boolean;
    }>;
    digestTimeLocal: string;
    digestTimezone: string;
    runnerPreference: "auto" | "demo" | "codex" | "claude";
    urgentCooldownMinutes: number;
    updatedAt: string | null;
  };
  scheduler: {
    lastTickAt: string | null;
    nextRunAt: string | null;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastDigestSentAt: string | null;
    lastStatus: "idle" | "running" | "success" | "blocked" | "error";
    lastDetail: string | null;
  };
  dedupe: {
    urgentFingerprints: Array<{
      fingerprint: string;
      seenAt: string;
      expiresAt: string;
    }>;
  };
  activity: {
    entries: Array<{
      id: string;
      ts: string;
      kind: string;
      summary: string;
      detail: string | null;
    }>;
  };
  promptTemplates: {
    summary: {
      template: string;
      isCustom: boolean;
    };
    urgent: {
      template: string;
      isCustom: boolean;
    };
  };
  ui: {
    startAtLogin: boolean;
    updateChannel: "stable";
    settingsOpen: boolean;
  };
};

function createDefaultAppConfig(): AppConfig {
  return {
    schemaVersion: 1,
    legal: {
      legalBundleVersion: null,
      appVersion: null,
      acceptedAt: null,
      locale: null,
      platform: null,
      docs: {
        termsVersion: null,
        privacyVersion: null,
        riskDisclosureVersion: null,
        retentionNoticeVersion: null,
      },
      requiredChecks: {
        acceptedTerms: false,
        acknowledgedPrivacy: false,
        acknowledgedRisk: false,
        acknowledgedRetentionCaveat: false,
      },
      optionalChoices: {
        analyticsOptIn: false,
        crashPrepOptIn: false,
      },
      providerConsents: [],
    },
    telegram: {
      encryptedBotToken: null,
      botUsername: null,
      chatId: null,
      onboardingState: "not_configured",
      lastVerifiedAt: null,
    },
    daemon: {
      port: 38765,
    },
    monitor: {
      enabled: false,
      watchedGroups: [],
      digestTimeLocal: "20:30",
      digestTimezone: "UTC",
      runnerPreference: "auto",
      urgentCooldownMinutes: 30,
      updatedAt: null,
    },
    scheduler: {
      lastTickAt: null,
      nextRunAt: null,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastDigestSentAt: null,
      lastStatus: "idle",
      lastDetail: null,
    },
    dedupe: {
      urgentFingerprints: [],
    },
    activity: {
      entries: [],
    },
    promptTemplates: {
      summary: {
        template: "summary",
        isCustom: false,
      },
      urgent: {
        template: "urgent",
        isCustom: false,
      },
    },
    ui: {
      startAtLogin: false,
      updateChannel: "stable",
      settingsOpen: false,
    },
  };
}

function preferredOutSegment(): string {
  switch (process.platform) {
    case "win32":
      return "-win32-";
    case "darwin":
      return "-darwin-";
    default:
      return "-linux-";
  }
}

export function resolvePackagedAppPath(): string {
  const outEntries = fs.existsSync(APP_OUT_DIR)
    ? fs
        .readdirSync(APP_OUT_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

  const preferredEntries = outEntries.filter((entry) => entry.includes(preferredOutSegment()));
  const orderedEntries = [
    ...preferredEntries,
    ...outEntries.filter((entry) => !preferredEntries.includes(entry)),
  ];

  const candidates = orderedEntries.flatMap((entry) => [
    path.join(APP_OUT_DIR, entry, "QuietClaw.exe"),
    path.join(APP_OUT_DIR, entry, "QuietClaw.app", "Contents", "MacOS", "QuietClaw"),
    path.join(APP_OUT_DIR, entry, "QuietClaw"),
  ]);

  const appPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!appPath) {
    throw new Error(`Packaged QuietClaw app not found under ${APP_OUT_DIR}. Run npm run build:app first.`);
  }

  return appPath;
}

export function getConfigDir(): string {
  switch (process.platform) {
    case "win32":
      return path.join(
        process.env.APPDATA ??
          path.join(process.env.USERPROFILE ?? PROJECT_ROOT, "AppData", "Roaming"),
        "QuietClaw",
      );
    case "darwin":
      return path.join(
        process.env.HOME ?? PROJECT_ROOT,
        "Library",
        "Application Support",
        "QuietClaw",
      );
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME ??
          path.join(process.env.HOME ?? PROJECT_ROOT, ".config"),
        "QuietClaw",
      );
  }
}

export function clearConfigJsonFiles(): void {
  const configDir = getConfigDir();

  try {
    const files = fs.readdirSync(configDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(configDir, file));
      }
    }
  } catch {
    // Directory may not exist yet.
  }
}

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

export function readSeededConfig(): AppConfig | null {
  try {
    return JSON.parse(fs.readFileSync(getConfigFilePath(), "utf8")) as AppConfig;
  } catch {
    return null;
  }
}

export function readDaemonPort(defaultPort = 38765): number {
  return readSeededConfig()?.daemon.port ?? defaultPort;
}

export function seedOnboardedConfig(
  overrides?: (config: AppConfig) => AppConfig,
): AppConfig {
  const baseConfig = createDefaultAppConfig();
  const now = new Date().toISOString();
  const acceptedLegal = {
    legalBundleVersion: LEGAL_BUNDLE_VERSION,
    appVersion: "0.0.0-test",
    acceptedAt: now,
    locale: "en-US",
    platform: process.platform,
    docs: {
      termsVersion: LEGAL_BUNDLE_VERSION,
      privacyVersion: LEGAL_BUNDLE_VERSION,
      riskDisclosureVersion: LEGAL_BUNDLE_VERSION,
      retentionNoticeVersion: LEGAL_BUNDLE_VERSION,
    },
    requiredChecks: {
      acceptedTerms: true,
      acknowledgedPrivacy: true,
      acknowledgedRisk: true,
      acknowledgedRetentionCaveat: true,
    },
    optionalChoices: {
      analyticsOptIn: false,
      crashPrepOptIn: false,
    },
    providerConsents: [],
  };
  const onboardedBase = {
    ...baseConfig,
    legal: acceptedLegal,
    telegram: {
      ...baseConfig.telegram,
      botUsername: "quietclaw_test_bot",
      chatId: 1,
      onboardingState: "ready" as const,
      lastVerifiedAt: now,
    },
  };
  const seeded = overrides
    ? overrides(onboardedBase)
    : onboardedBase;

  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(getConfigFilePath(), `${JSON.stringify(seeded, null, 2)}\n`, "utf8");
  return seeded;
}

export function spawnTsxScript(
  relativeScriptPath: string,
  env: Record<string, string> = {},
): ChildProcess {
  return spawn(process.execPath, [TSX_CLI_PATH, relativeScriptPath], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    env: { ...process.env, ...env },
  });
}

export async function waitForListening(
  proc: ChildProcess,
  label: string,
  timeoutMs = 15_000,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} startup timeout`)), timeoutMs);

    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const message = data.toString();
      if (message.includes("Error") || message.includes("EADDRINUSE")) {
        clearTimeout(timeout);
        reject(new Error(`${label} error: ${message}`));
      }
    });

    proc.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`${label} exited before startup with code ${code ?? "unknown"}`));
    });
  });
}
