import { afterEach, describe, expect, test, vi } from "vitest";

import { TelegramBot } from "../../apps/desktop-monitor/src/main/telegram/bot";

describe("TelegramBot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("getMe returns the bot username", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        ok: true,
        result: {
          username: "quietclaw_bot",
        },
      }))));

    const bot = new TelegramBot("token");
    await expect(bot.getMe()).resolves.toEqual({
      ok: true,
      username: "quietclaw_bot",
    });
  });

  test("getUpdates returns parsed updates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        ok: true,
        result: [
          {
            update_id: 10,
            message: {
              chat: { id: 42 },
              text: "/start",
            },
          },
        ],
      }))));

    const bot = new TelegramBot("token");
    await expect(bot.getUpdates(5)).resolves.toEqual([
      {
        update_id: 10,
        message: {
          chat: { id: 42 },
          text: "/start",
        },
      },
    ]);
  });

  test("sendMessage retries on 429", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", {
        status: 429,
        headers: { "retry-after": "0" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: { message_id: 55 },
      }))));

    const bot = new TelegramBot("token");
    await expect(bot.sendMessage(1, "hello")).resolves.toEqual({
      ok: true,
      messageId: 55,
    });
  });
});
