import { describe, expect, test, vi } from "vitest";

import {
  TelegramOnboarding,
  type TelegramOnboardingState,
} from "../../apps/desktop-monitor/src/main/telegram/onboarding";
import { FakeTelegramBot } from "../../apps/desktop-monitor/src/main/telegram/fakeBot";

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

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

  test("promotes to ready when a prior private /start is already available", async () => {
    const config = {
      encryptedBotToken: null,
      botUsername: null,
      chatId: null,
      onboardingState: "not_configured" as TelegramOnboardingState,
      lastVerifiedAt: null,
    };
    const bot = new FakeTelegramBot({
      getMeResult: { ok: true, username: "quietclaw_bot" },
      updates: [
        {
          update_id: 1,
          message: {
            chat: { id: 321, type: "private" },
            text: "/start",
          },
        },
      ],
    });

    const onboarding = new TelegramOnboarding(
      () => undefined,
      {
        getTelegramConfig: () => config,
        setTelegramConfig: (updater) => {
          Object.assign(config, updater(config));
        },
      },
      () => bot,
    );

    const result = await onboarding.setBotToken("token");

    expect(result.ok).toBe(true);
    await flushAsyncWork();
    expect(onboarding.getStatus()).toEqual({
      state: "ready",
      botUsername: "quietclaw_bot",
      chatId: 321,
    });
    onboarding.destroy();
  });

  test("promotes to ready when a prior private message exists without /start", async () => {
    const config = {
      encryptedBotToken: null,
      botUsername: null,
      chatId: null,
      onboardingState: "not_configured" as TelegramOnboardingState,
      lastVerifiedAt: null,
    };
    const bot = new FakeTelegramBot({
      getMeResult: { ok: true, username: "quietclaw_bot" },
      updates: [
        {
          update_id: 7,
          message: {
            chat: { id: 654, type: "private" },
            text: "hello again",
          },
        },
      ],
    });

    const onboarding = new TelegramOnboarding(
      () => undefined,
      {
        getTelegramConfig: () => config,
        setTelegramConfig: (updater) => {
          Object.assign(config, updater(config));
        },
      },
      () => bot,
    );

    const result = await onboarding.setBotToken("token");

    expect(result.ok).toBe(true);
    await flushAsyncWork();
    expect(onboarding.getStatus()).toEqual({
      state: "ready",
      botUsername: "quietclaw_bot",
      chatId: 654,
    });
    onboarding.destroy();
  });

  test("does not promote to ready from non-private chat traffic", async () => {
    const config = {
      encryptedBotToken: null,
      botUsername: null,
      chatId: null,
      onboardingState: "not_configured" as TelegramOnboardingState,
      lastVerifiedAt: null,
    };
    const bot = new FakeTelegramBot({
      getMeResult: { ok: true, username: "quietclaw_bot" },
      updates: [
        {
          update_id: 9,
          message: {
            chat: { id: -1001, type: "group" },
            text: "hello group",
          },
        },
      ],
    });

    const onboarding = new TelegramOnboarding(
      () => undefined,
      {
        getTelegramConfig: () => config,
        setTelegramConfig: (updater) => {
          Object.assign(config, updater(config));
        },
      },
      () => bot,
    );

    const result = await onboarding.setBotToken("token");

    expect(result.ok).toBe(true);
    await flushAsyncWork();
    expect(onboarding.getStatus()).toEqual({
      state: "waiting_for_start",
      botUsername: "quietclaw_bot",
      chatId: null,
    });
    onboarding.destroy();
  });
});
