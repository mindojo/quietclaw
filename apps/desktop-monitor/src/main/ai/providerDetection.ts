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

type ProviderId = "claude" | "codex";

export type AiProviderDetectionDeps = {
  checkInstalled(command: ProviderId): Promise<boolean>;
  checkAuth(provider: ProviderId): Promise<AiProviderAuthStatus>;
};

function trimDetail(output: string, fallback: string): string {
  const detail = output.trim().replace(/\s+/g, " ");
  return detail.slice(0, 100) || fallback;
}

export function parseClaudeAuthStatus(output: string): AiProviderAuthStatus {
  const normalized = output.trim();

  try {
    const parsed = JSON.parse(normalized) as {
      loggedIn?: boolean;
      email?: string;
      subscriptionType?: string;
    };

    if (parsed.loggedIn) {
      const detail = [parsed.email, parsed.subscriptionType].filter(Boolean).join(" · ");
      return {
        loggedIn: true,
        detail: detail || "Authenticated",
      };
    }

    return {
      loggedIn: false,
      detail: "Not logged in",
    };
  } catch {
    const lower = normalized.toLowerCase();
    if (lower.includes("logged in") || lower.includes("authenticated")) {
      return {
        loggedIn: true,
        detail: trimDetail(normalized, "Authenticated"),
      };
    }

    if (
      lower.includes("not logged in") ||
      lower.includes("not authenticated") ||
      lower.includes("login required") ||
      lower.includes("sign in")
    ) {
      return {
        loggedIn: false,
        detail: trimDetail(normalized, "Not authenticated"),
      };
    }

    return {
      loggedIn: normalized.length > 0,
      detail: trimDetail(normalized, "Unknown status"),
    };
  }
}

export function parseCodexAuthStatus(output: string): AiProviderAuthStatus {
  const normalized = output.trim();
  const lower = normalized.toLowerCase();

  if (
    lower.includes("logged in") ||
    lower.includes("authenticated") ||
    lower.includes("using chatgpt") ||
    lower.includes("using api key")
  ) {
    return {
      loggedIn: true,
      detail: trimDetail(normalized, "Authenticated"),
    };
  }

  if (
    lower.includes("not logged in") ||
    lower.includes("not authenticated") ||
    lower.includes("login required") ||
    lower.includes("run codex login")
  ) {
    return {
      loggedIn: false,
      detail: trimDetail(normalized, "Not authenticated"),
    };
  }

  return {
    loggedIn: false,
    detail: trimDetail(normalized, "Installed; login status unavailable"),
  };
}

function notInstalled(): AiProviderAuthStatus {
  return {
    loggedIn: false,
    detail: "Not installed",
  };
}

async function safeCheckAuth(
  provider: ProviderId,
  installed: boolean,
  deps: AiProviderDetectionDeps,
): Promise<AiProviderAuthStatus> {
  if (!installed) {
    return notInstalled();
  }

  try {
    return await deps.checkAuth(provider);
  } catch (error) {
    return {
      loggedIn: false,
      detail: error instanceof Error ? error.message : "Authentication check failed.",
    };
  }
}

export async function detectAiProviders(
  deps: AiProviderDetectionDeps,
): Promise<AiProviderDetection> {
  const [claudeInstalled, codexInstalled] = await Promise.all([
    deps.checkInstalled("claude"),
    deps.checkInstalled("codex"),
  ]);

  const [claudeAuth, codexAuth] = await Promise.all([
    safeCheckAuth("claude", claudeInstalled, deps),
    safeCheckAuth("codex", codexInstalled, deps),
  ]);

  return {
    claude: claudeInstalled,
    codex: codexInstalled,
    claudeAuth,
    codexAuth,
  };
}
