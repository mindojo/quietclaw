import {
  AppConfigSchema,
  createDefaultAppConfig,
  createDefaultLegalAcceptanceRecord,
  type AppConfig,
  type LegalAcceptanceRecord,
} from "./schema";

type MaybePartialAppConfig = Partial<AppConfig> & {
  legal?: Partial<AppConfig["legal"]> & {
    accepted?: boolean;
    acceptedVersion?: string | null;
    acceptedAt?: string | null;
  };
  telegram?: Partial<AppConfig["telegram"]>;
  daemon?: Partial<AppConfig["daemon"]>;
  monitor?: Partial<AppConfig["monitor"]>;
  scheduler?: Partial<AppConfig["scheduler"]>;
  dedupe?: Partial<AppConfig["dedupe"]>;
  activity?: Partial<AppConfig["activity"]>;
  promptTemplates?: Partial<AppConfig["promptTemplates"]>;
  ui?: Partial<AppConfig["ui"]>;
  connection?: {
    encryptedToken?: string | null;
  };
};

export function coerceAppConfig(input: unknown): AppConfig {
  const defaults = createDefaultAppConfig();
  const raw = isObject(input) ? (input as MaybePartialAppConfig) : {};

  return AppConfigSchema.parse({
    ...defaults,
    ...raw,
    legal: normalizeLegalRecord(raw.legal),
    telegram: {
      ...defaults.telegram,
      ...raw.telegram,
      encryptedBotToken:
        raw.telegram?.encryptedBotToken ??
        raw.connection?.encryptedToken ??
        defaults.telegram.encryptedBotToken,
    },
    daemon: {
      ...defaults.daemon,
      ...raw.daemon,
    },
    monitor: {
      ...defaults.monitor,
      ...raw.monitor,
      watchedGroups: raw.monitor?.watchedGroups ?? defaults.monitor.watchedGroups,
    },
    scheduler: {
      ...defaults.scheduler,
      ...raw.scheduler,
    },
    dedupe: {
      ...defaults.dedupe,
      urgentFingerprints:
        raw.dedupe?.urgentFingerprints ?? defaults.dedupe.urgentFingerprints,
    },
    activity: {
      ...defaults.activity,
      entries: raw.activity?.entries ?? defaults.activity.entries,
    },
    promptTemplates: {
      summary: {
        ...defaults.promptTemplates.summary,
        ...raw.promptTemplates?.summary,
      },
      urgent: {
        ...defaults.promptTemplates.urgent,
        ...raw.promptTemplates?.urgent,
      },
    },
    ui: {
      ...defaults.ui,
      ...raw.ui,
    },
  });
}

function normalizeLegalRecord(input: MaybePartialAppConfig["legal"]): LegalAcceptanceRecord {
  const defaults = createDefaultLegalAcceptanceRecord();
  const raw = (input ?? {}) as NonNullable<MaybePartialAppConfig["legal"]>;
  const legacyAccepted = raw.accepted === true;
  const legacyVersion = raw.acceptedVersion ?? null;

  const legal: LegalAcceptanceRecord = {
    ...defaults,
    ...raw,
    docs: {
      ...defaults.docs,
      ...raw.docs,
    },
    requiredChecks: {
      ...defaults.requiredChecks,
      ...raw.requiredChecks,
    },
    optionalChoices: {
      ...defaults.optionalChoices,
      ...raw.optionalChoices,
    },
    providerConsents: raw.providerConsents ?? defaults.providerConsents,
  };

  if (legacyAccepted) {
    legal.legalBundleVersion = "legacy-v1";
    legal.acceptedAt = raw.acceptedAt ?? legal.acceptedAt;
    legal.requiredChecks = {
      acceptedTerms: true,
      acknowledgedPrivacy: true,
      acknowledgedRisk: true,
      acknowledgedRetentionCaveat: true,
    };

    if (!legal.docs.termsVersion && legacyVersion) {
      legal.docs = {
        termsVersion: legacyVersion,
        privacyVersion: legacyVersion,
        riskDisclosureVersion: legacyVersion,
        retentionNoticeVersion: legacyVersion,
      };
    }
  }

  return legal;
}

type MigrationStore = {
  store: unknown;
};

export const appConfigMigrations = {
  "0.0.0": (store: MigrationStore) => {
    store.store = coerceAppConfig(store.store);
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
