import { describe, expect, test, vi } from "vitest";

import {
  detectAiProviders,
  parseClaudeAuthStatus,
  parseCodexAuthStatus,
} from "../../apps/desktop-monitor/src/main/ai/providerDetection.js";

describe("detectAiProviders", () => {
  test("reports codex-only environments", async () => {
    const checkInstalled = vi.fn(async (command: "claude" | "codex") => command === "codex");
    const checkAuth = vi.fn(async (provider: "claude" | "codex") => ({
      loggedIn: provider === "codex",
      detail: provider === "codex" ? "Logged in using ChatGPT" : "Not installed",
    }));

    const result = await detectAiProviders({ checkInstalled, checkAuth });

    expect(result).toEqual({
      claude: false,
      codex: true,
      claudeAuth: { loggedIn: false, detail: "Not installed" },
      codexAuth: { loggedIn: true, detail: "Logged in using ChatGPT" },
    });
    expect(checkAuth).toHaveBeenCalledTimes(1);
    expect(checkAuth).toHaveBeenCalledWith("codex");
  });

  test("reports claude-only environments", async () => {
    const result = await detectAiProviders({
      checkInstalled: async (command) => command === "claude",
      checkAuth: async (provider) => ({
        loggedIn: provider === "claude",
        detail: provider === "claude" ? "Authenticated" : "Not installed",
      }),
    });

    expect(result.claude).toBe(true);
    expect(result.codex).toBe(false);
    expect(result.claudeAuth).toEqual({ loggedIn: true, detail: "Authenticated" });
    expect(result.codexAuth).toEqual({ loggedIn: false, detail: "Not installed" });
  });

  test("reports both providers when both are installed", async () => {
    const result = await detectAiProviders({
      checkInstalled: async () => true,
      checkAuth: async (provider) => ({
        loggedIn: provider === "codex",
        detail: provider === "codex" ? "Logged in using ChatGPT" : "Not authenticated",
      }),
    });

    expect(result).toEqual({
      claude: true,
      codex: true,
      claudeAuth: { loggedIn: false, detail: "Not authenticated" },
      codexAuth: { loggedIn: true, detail: "Logged in using ChatGPT" },
    });
  });

  test("reports neither provider when neither is installed", async () => {
    const checkAuth = vi.fn();

    const result = await detectAiProviders({
      checkInstalled: async () => false,
      checkAuth,
    });

    expect(result).toEqual({
      claude: false,
      codex: false,
      claudeAuth: { loggedIn: false, detail: "Not installed" },
      codexAuth: { loggedIn: false, detail: "Not installed" },
    });
    expect(checkAuth).not.toHaveBeenCalled();
  });

  test("fails closed when an auth check throws", async () => {
    const result = await detectAiProviders({
      checkInstalled: async () => true,
      checkAuth: async (provider) => {
        if (provider === "claude") {
          throw new Error("spawn claude ENOENT");
        }

        return {
          loggedIn: true,
          detail: "Logged in using ChatGPT",
        };
      },
    });

    expect(result.claude).toBe(true);
    expect(result.claudeAuth).toEqual({
      loggedIn: false,
      detail: "spawn claude ENOENT",
    });
    expect(result.codexAuth).toEqual({
      loggedIn: true,
      detail: "Logged in using ChatGPT",
    });
  });
});

describe("provider auth status parsing", () => {
  test("parses Claude JSON auth output", () => {
    expect(
      parseClaudeAuthStatus(
        JSON.stringify({
          loggedIn: true,
          email: "user@example.com",
          subscriptionType: "Pro",
        }),
      ),
    ).toEqual({
      loggedIn: true,
      detail: "user@example.com · Pro",
    });
  });

  test("parses Claude text auth output", () => {
    expect(parseClaudeAuthStatus("Authenticated as user@example.com")).toEqual({
      loggedIn: true,
      detail: "Authenticated as user@example.com",
    });
  });

  test("parses Codex login status from mixed output", () => {
    const output = [
      "Warning: ignoring stale temp dir",
      "Logged in using ChatGPT",
    ].join("\n");

    expect(parseCodexAuthStatus(output)).toEqual({
      loggedIn: true,
      detail: "Warning: ignoring stale temp dir Logged in using ChatGPT",
    });
  });

  test("fails closed for unknown Codex auth output", () => {
    expect(parseCodexAuthStatus("warning: transient CLI noise")).toEqual({
      loggedIn: false,
      detail: "warning: transient CLI noise",
    });
  });
});
