import Store from "electron-store";

import {
  decryptTelegramBotToken as decryptStoredTelegramBotToken,
  encryptTelegramBotToken,
  type DecryptedTokenState,
  type TokenStorageMode,
} from "../security/secrets";
import { appConfigMigrations, coerceAppConfig } from "./migrations";
import {
  AppConfigSchema,
  createDefaultAppConfig,
  type AppConfig,
} from "./schema";

const STORE_NAME = "desktop-monitor-config";

let appStore: Store<AppConfig> | null = null;
let configOverride: AppConfig | null = null;

function createStore(): Store<AppConfig> {
  const store = new Store<AppConfig>({
    clearInvalidConfig: false,
    defaults: createDefaultAppConfig(),
    migrations: appConfigMigrations,
    name: STORE_NAME,
  });

  store.store = coerceAppConfig(store.store);
  return store;
}

export function getAppStore(): Store<AppConfig> {
  appStore ??= createStore();
  return appStore;
}

export function readAppConfig(): AppConfig {
  if (configOverride) {
    return coerceAppConfig(configOverride);
  }

  return coerceAppConfig(getAppStore().store);
}

export function writeAppConfig(nextConfig: AppConfig): AppConfig {
  const parsed = AppConfigSchema.parse(nextConfig);
  if (configOverride) {
    configOverride = parsed;
    return parsed;
  }

  getAppStore().store = parsed;
  return parsed;
}

export function updateAppConfig(updater: (config: AppConfig) => AppConfig): AppConfig {
  return writeAppConfig(updater(readAppConfig()));
}

export function decryptTelegramBotToken(
  encryptedToken: string | null,
): DecryptedTokenState {
  const decrypted = decryptStoredTelegramBotToken(encryptedToken);

  if (decrypted.recoveryRequired) {
    if (configOverride) {
      configOverride = {
        ...configOverride,
        telegram: {
          ...configOverride.telegram,
          encryptedBotToken: null,
        },
      };
    } else {
      getAppStore().set("telegram.encryptedBotToken", null);
    }
  }

  return decrypted;
}

export function setAppConfigOverride(config: AppConfig | null): void {
  configOverride = config ? AppConfigSchema.parse(config) : null;
}

export { encryptTelegramBotToken };
