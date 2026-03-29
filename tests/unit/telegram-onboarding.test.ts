import { describe, expect, test, vi } from "vitest";

import {
  TelegramOnboarding,
  type TelegramOnboardingState,
} from "../../apps/desktop-monitor/src/main/telegram/onboarding";

describe("TelegramOnboarding", () => {
  test("setBotToken transitions into waiting state after verification", async () => {
    const config = {
      encryptedBotToken: null,
      botUsername: null,
      chatId: null,
      onboardingState: "not_configured" as TelegramOnboardingState,
      lastVerifiedAt: null,
    };
    const changes: TelegramOnboardingState[] = [];

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      result: { username: "quietclaw_bot" },
    })) as Response);

    const onboarding = new TelegramOnboarding(
      (state) => {
        changes.push(state);
      },
      {
        getTelegramConfig: () => config,
        setTelegramConfig: (updater) => {
          Object.assign(config, updater(config));
        },
      },
    );

    const result = await onboarding.setBotToken("token");

    expect(result.ok).toBe(true);
    expect(config.botUsername).toBe("quietclaw_bot");
    expect(changes).toContain("waiting_for_start");
    onboarding.destroy();
  });

  test("constructor restores ready state from stored chat", () => {
    const changes: TelegramOnboardingState[] = [];
    const onboarding = new TelegramOnboarding(
      (state) => {
        changes.push(state);
      },
      {
        getTelegramConfig: () => ({
          encryptedBotToken: "weak:dG9rZW4=",
          botUsername: "quietclaw_bot",
          chatId: 42,
          onboardingState: "ready" as TelegramOnboardingState,
          lastVerifiedAt: null,
        }),
        setTelegramConfig: () => undefined,
      },
    );

    expect(onboarding.getStatus()).toEqual({
      state: "ready",
      botUsername: "quietclaw_bot",
      chatId: 42,
    });
    expect(changes).toContain("ready");
    onboarding.destroy();
  });
});
