import { describe, expect, test } from "vitest";

import { coerceAppConfig } from "../../apps/desktop-monitor/src/main/config/migrations";
import {
  LEGAL_BUNDLE_VERSION,
  createDefaultAppConfig,
} from "../../apps/desktop-monitor/src/main/config/schema";

describe("legal acceptance", () => {
  test("default config starts with all required checks false", () => {
    const config = createDefaultAppConfig();

    expect(config.legal.requiredChecks).toEqual({
      acceptedTerms: false,
      acknowledgedPrivacy: false,
      acknowledgedRisk: false,
      acknowledgedRetentionCaveat: false,
    });
  });

  test("LEGAL_BUNDLE_VERSION is defined and non-empty", () => {
    expect(typeof LEGAL_BUNDLE_VERSION).toBe("string");
    expect(LEGAL_BUNDLE_VERSION.length).toBeGreaterThan(0);
  });

  test("migration from legacy accepted format preserves acceptance fields", () => {
    const migrated = coerceAppConfig({
      legal: {
        accepted: true,
        acceptedVersion: "desktop-pack-v1",
        acceptedAt: "2026-03-28T10:00:00.000Z",
      },
    });

    expect(migrated.legal.legalBundleVersion).toBe("legacy-v1");
    expect(migrated.legal.acceptedAt).toBe("2026-03-28T10:00:00.000Z");
    expect(migrated.legal.requiredChecks).toEqual({
      acceptedTerms: true,
      acknowledgedPrivacy: true,
      acknowledgedRisk: true,
      acknowledgedRetentionCaveat: true,
    });
    expect(migrated.legal.docs).toEqual({
      termsVersion: "desktop-pack-v1",
      privacyVersion: "desktop-pack-v1",
      riskDisclosureVersion: "desktop-pack-v1",
      retentionNoticeVersion: "desktop-pack-v1",
    });
  });
});
