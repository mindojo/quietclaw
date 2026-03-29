import { DateTime } from "luxon";
import { RunnerPreference as RunnerPreferenceSchema } from "@quietclaw/gateway-contract";
import { z } from "zod";

import {
  DEFAULT_SUMMARY_TEMPLATE,
  DEFAULT_URGENT_TEMPLATE,
} from "./promptDefaults.js";

export const LEGAL_ACCEPTED_VERSION = "desktop-pack-v1";

const RunnerTimezoneSchema = z.string().refine(
  (value) => DateTime.local().setZone(value).isValid,
  "Expected a valid IANA timezone.",
);

export const AppConfigSchema = z.object({
  schemaVersion: z.literal(1),

  legal: z.object({
    accepted: z.boolean(),
    acceptedVersion: z.string().nullable(),
    acceptedAt: z.string().nullable(),
  }),

  telegram: z.object({
    encryptedBotToken: z.string().nullable(),
    botUsername: z.string().nullable(),
    chatId: z.number().nullable(),
    onboardingState: z
      .enum(["not_configured", "token_entered", "waiting_for_start", "ready"])
      .default("not_configured"),
    lastVerifiedAt: z.string().nullable(),
  }),

  daemon: z.object({
    port: z.number().int().min(1).max(65535).default(38765),
  }),

  monitor: z.object({
    enabled: z.boolean(),
    watchedGroups: z.array(
      z.object({
        groupId: z.string(),
        dailySummary: z.boolean(),
        forwardUrgent: z.boolean(),
      }),
    ),
    digestTimeLocal: z.string(),
    digestTimezone: RunnerTimezoneSchema,
    runnerPreference: RunnerPreferenceSchema,
    urgentCooldownMinutes: z.number().int().min(1).max(180).default(30),
    updatedAt: z.string().nullable(),
  }),

  scheduler: z.object({
    lastTickAt: z.string().nullable(),
    nextRunAt: z.string().nullable(),
    lastStartedAt: z.string().nullable(),
    lastFinishedAt: z.string().nullable(),
    lastDigestSentAt: z.string().nullable(),
    lastStatus: z
      .enum(["idle", "running", "success", "blocked", "error"])
      .default("idle"),
    lastDetail: z.string().nullable(),
  }),

  dedupe: z.object({
    urgentFingerprints: z
      .array(
        z.object({
          fingerprint: z.string(),
          seenAt: z.string(),
          expiresAt: z.string(),
        }),
      )
      .max(2000),
  }),

  activity: z.object({
    entries: z
      .array(
        z.object({
          id: z.string(),
          ts: z.string(),
          kind: z.enum([
            "daemon_started",
            "telegram_ready",
            "telegram_blocked",
            "gateway_connected",
            "gateway_disconnected",
            "gateway_backfilling",
            "gateway_pairing_required",
            "monitor_saved",
            "urgent_detected",
            "urgent_skipped",
            "urgent_blocked",
            "urgent_queued",
            "digest_started",
            "digest_blocked",
            "digest_queued",
            "digest_empty",
            "runner_unavailable",
            "membership_blocked",
            "manual_test_sent",
          ]),
          summary: z.string(),
          detail: z.string().nullable(),
        }),
      )
      .max(1000),
  }),

  promptTemplates: z.object({
    summary: z.object({
      template: z.string(),
      isCustom: z.boolean(),
    }).default({
      template: DEFAULT_SUMMARY_TEMPLATE,
      isCustom: false,
    }),
    urgent: z.object({
      template: z.string(),
      isCustom: z.boolean(),
    }).default({
      template: DEFAULT_URGENT_TEMPLATE,
      isCustom: false,
    }),
  }).default({}),

  ui: z.object({
    startAtLogin: z.boolean().default(false),
    updateChannel: z.enum(["stable"]).default("stable"),
    settingsOpen: z.boolean().default(false),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type RunnerPreference = z.infer<typeof RunnerPreferenceSchema>;
export type ActivityEntry = AppConfig["activity"]["entries"][number];
export type ActivityKind = ActivityEntry["kind"];

function getDefaultTimeZone(): string {
  const timeZone = DateTime.local().zoneName;
  return timeZone && DateTime.local().setZone(timeZone).isValid ? timeZone : "UTC";
}

export function createDefaultAppConfig(): AppConfig {
  return {
    schemaVersion: 1,
    legal: {
      accepted: false,
      acceptedVersion: null,
      acceptedAt: null,
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
      digestTimezone: getDefaultTimeZone(),
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
        template: DEFAULT_SUMMARY_TEMPLATE,
        isCustom: false,
      },
      urgent: {
        template: DEFAULT_URGENT_TEMPLATE,
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
