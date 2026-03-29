import { readAppConfig, updateAppConfig } from "../config/store";
import { decryptTelegramBotToken, encryptTelegramBotToken } from "../config/store";
import { TelegramBot, type TelegramBotLike } from "./bot";

export type TelegramOnboardingState =
  | "not_configured"
  | "token_entered"
  | "waiting_for_start"
  | "ready";

type TelegramConfigStore = {
  getTelegramConfig(): {
    encryptedBotToken: string | null;
    botUsername: string | null;
    chatId: number | null;
    onboardingState: TelegramOnboardingState;
    lastVerifiedAt: string | null;
  };
  setTelegramConfig(
    updater: (
      current: ReturnType<TelegramConfigStore["getTelegramConfig"]>,
    ) => ReturnType<TelegramConfigStore["getTelegramConfig"]>,
  ): void;
};

export class TelegramOnboarding {
  private bot: TelegramBotLike | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private updateOffset = 0;
  private state: TelegramOnboardingState = "not_configured";
  private botUsername: string | null = null;
  private chatId: number | null = null;
  private polling = false;

  constructor(
    private readonly onStateChanged: (
      state: TelegramOnboardingState,
      detail: { botUsername?: string; chatId?: number },
    ) => void,
    private readonly configStore: TelegramConfigStore,
    private readonly botFactory: (token: string) => TelegramBotLike = (token) => new TelegramBot(token),
  ) {
    const config = this.configStore.getTelegramConfig();
    const decrypted = decryptTelegramBotToken(config.encryptedBotToken);

    this.state = config.onboardingState;
    this.botUsername = config.botUsername;
    this.chatId = config.chatId;

    if (decrypted.token) {
      this.bot = this.botFactory(decrypted.token);
    }

    if (config.chatId !== null && config.botUsername) {
      this.transition("ready", {
        botUsername: config.botUsername,
        chatId: config.chatId,
      });
      return;
    }

    if (this.bot && config.botUsername) {
      this.transition("waiting_for_start", {
        botUsername: config.botUsername,
      });
      this.startPolling();
    } else {
      this.transition("not_configured", {});
    }
  }

  async setBotToken(token: string): Promise<{ ok: boolean; error?: string }> {
    const nextToken = token.trim();
    if (!nextToken) {
      return {
        ok: false,
        error: "Telegram bot token is required.",
      };
    }

    const nextBot = this.botFactory(nextToken);

    try {
      const me = await nextBot.getMe();
      const encrypted = encryptTelegramBotToken(nextToken);
      this.bot = nextBot;
      this.updateOffset = 0;

      // Check if this bot already has a /start chat from a previous session
      const currentConfig = this.configStore.getTelegramConfig();
      const sameBotReconnecting = currentConfig.botUsername === me.username && currentConfig.chatId !== null;

      if (sameBotReconnecting) {
        // Same bot, already has a chatId — skip /start flow
        this.chatId = currentConfig.chatId;
        this.configStore.setTelegramConfig((current) => ({
          ...current,
          encryptedBotToken: encrypted.encryptedToken,
          botUsername: me.username,
          onboardingState: "ready",
          lastVerifiedAt: new Date().toISOString(),
        }));
        this.transition("ready", {
          botUsername: me.username,
          chatId: currentConfig.chatId!,
        });
        return { ok: true };
      }

      // New bot or no prior chatId — need /start flow
      this.configStore.setTelegramConfig((current) => ({
        ...current,
        encryptedBotToken: encrypted.encryptedToken,
        botUsername: me.username,
        chatId: null,
        onboardingState: "token_entered",
        lastVerifiedAt: new Date().toISOString(),
      }));
      this.transition("waiting_for_start", {
        botUsername: me.username,
      });
      this.startPolling();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Telegram bot verification failed.",
      };
    }
  }

  startPolling(): void {
    if (!this.bot || this.pollInterval) {
      return;
    }

    this.transition("waiting_for_start", {
      ...(this.botUsername ? { botUsername: this.botUsername } : {}),
    });

    this.pollInterval = setInterval(() => {
      void this.pollOnce();
    }, 3000);
    void this.pollOnce();
  }

  stopPolling(): void {
    if (!this.pollInterval) {
      return;
    }

    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }

  getStatus(): {
    state: TelegramOnboardingState;
    botUsername: string | null;
    chatId: number | null;
  } {
    return {
      state: this.state,
      botUsername: this.botUsername,
      chatId: this.chatId,
    };
  }

  getBot(): TelegramBotLike | null {
    return this.bot;
  }

  destroy(): void {
    this.stopPolling();
  }

  reset(): void {
    this.stopPolling();
    this.bot = null;
    this.updateOffset = 0;
    this.botUsername = null;
    this.chatId = null;
    this.configStore.setTelegramConfig((current) => ({
      ...current,
      encryptedBotToken: null,
      botUsername: null,
      chatId: null,
      onboardingState: "not_configured",
      lastVerifiedAt: null,
    }));
    this.transition("not_configured", {});
  }

  private async pollOnce(): Promise<void> {
    if (!this.bot || this.polling || this.state === "ready") {
      return;
    }

    this.polling = true;

    try {
      const updates = await this.bot.getUpdates(this.updateOffset > 0 ? this.updateOffset : undefined);

      for (const update of updates) {
        this.updateOffset = Math.max(this.updateOffset, update.update_id + 1);
        const messageText = update.message?.text?.trim();
        const chatId = update.message?.chat.id;

        if (messageText === "/start" && typeof chatId === "number") {
          this.chatId = chatId;
          this.configStore.setTelegramConfig((current) => ({
            ...current,
            chatId,
            onboardingState: "ready",
          }));
          this.transition("ready", {
            ...(this.botUsername ? { botUsername: this.botUsername } : {}),
            chatId,
          });
          this.stopPolling();
          break;
        }
      }
    } catch {
      // Keep polling; onboarding should stay fail-closed until /start is observed.
    } finally {
      this.polling = false;
    }
  }

  private transition(
    state: TelegramOnboardingState,
    detail: { botUsername?: string; chatId?: number },
  ): void {
    this.state = state;
    if (detail.botUsername) {
      this.botUsername = detail.botUsername;
    }
    if (typeof detail.chatId === "number") {
      this.chatId = detail.chatId;
    }
    this.onStateChanged(state, detail);
  }
}

export const telegramConfigStore: TelegramConfigStore = {
  getTelegramConfig: () => readAppConfig().telegram,
  setTelegramConfig: (updater) => {
    updateAppConfig((current) => ({
      ...current,
      telegram: updater(current.telegram),
    }));
  },
};
