import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";

import {
  appConfigMigrations,
  coerceAppConfig,
} from "../../apps/desktop-monitor/src/main/config/migrations";
import {
  AppConfigSchema,
  createDefaultAppConfig,
} from "../../apps/desktop-monitor/src/main/config/schema";

describe("config schema and migrations", () => {
  test("createDefaultAppConfig returns a valid config", () => {
    const config = createDefaultAppConfig();

    expect(() => AppConfigSchema.parse(config)).not.toThrow();
    expect(config.monitor.digestTimeLocal).toBe("20:30");
    expect(DateTime.local().setZone(config.monitor.digestTimezone).isValid).toBe(
      true,
    );
  });

  test("coerceAppConfig with an empty object returns valid defaults", () => {
    const config = coerceAppConfig({});

    expect(() => AppConfigSchema.parse(config)).not.toThrow();
    expect(config.monitor.digestTimeLocal).toBe("20:30");
    expect(config.monitor.watchedGroups).toEqual([]);
  });

  test("coerceAppConfig merges partial nested config values with defaults", () => {
    const config = coerceAppConfig({
      telegram: {
        botUsername: "quietclaw_bot",
      },
      daemon: {
        port: 39001,
      },
      monitor: {
        enabled: true,
        digestTimeLocal: "09:15",
      },
      ui: {
        settingsOpen: true,
      },
    });

    expect(config.telegram.botUsername).toBe("quietclaw_bot");
    expect(config.daemon.port).toBe(39001);
    expect(config.monitor.enabled).toBe(true);
    expect(config.monitor.digestTimeLocal).toBe("09:15");
    expect(config.monitor.watchedGroups).toEqual([]);
    expect(config.ui.settingsOpen).toBe(true);
    expect(config.ui.startAtLogin).toBe(false);
  });

  test.each([0, 99999])("AppConfigSchema rejects invalid daemon port %d", (port) => {
    const config = createDefaultAppConfig();
    const parsed = AppConfigSchema.safeParse({
      ...config,
      daemon: {
        ...config.daemon,
        port,
      },
    });

    expect(parsed.success).toBe(false);
  });

  test("AppConfigSchema validates activity entry kinds as an enum", () => {
    const config = createDefaultAppConfig();

    const valid = AppConfigSchema.safeParse({
      ...config,
      activity: {
        entries: [
          {
            id: "act_001",
            ts: "2026-03-25T10:00:00.000Z",
            kind: "urgent_detected",
            summary: "Urgent message detected.",
            detail: null,
          },
        ],
      },
    });
    const invalid = AppConfigSchema.safeParse({
      ...config,
      activity: {
        entries: [
          {
            id: "act_002",
            ts: "2026-03-25T10:00:00.000Z",
            kind: "not_a_real_kind",
            summary: "Invalid activity.",
            detail: null,
          },
        ],
      },
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  test("appConfigMigrations coerces legacy store content into the current schema", () => {
    const store = {
      store: {
        connection: {
          encryptedToken: "legacy-token",
        },
        monitor: {
          enabled: true,
        },
      },
    };

    appConfigMigrations["0.0.0"](store);

    expect(() => AppConfigSchema.parse(store.store)).not.toThrow();
    expect((store.store as ReturnType<typeof coerceAppConfig>).telegram.encryptedBotToken).toBe(
      "legacy-token",
    );
    expect((store.store as ReturnType<typeof coerceAppConfig>).monitor.enabled).toBe(
      true,
    );
  });
});
