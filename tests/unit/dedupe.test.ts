import { describe, expect, test } from "vitest";

import {
  buildUrgentFingerprint,
  hasActiveUrgentFingerprint,
  pruneExpiredUrgentFingerprints,
  rememberUrgentFingerprint,
} from "../../apps/desktop-monitor/src/main/monitors/dedupe";

describe("dedupe", () => {
  test("buildUrgentFingerprint is stable for the same inputs and different for changed inputs", () => {
    const base = {
      groupId: "grp_parents_001",
      normalizedText: "urgent pickup now",
      timestamp: "2026-03-25T10:01:30.000Z",
      cooldownMinutes: 5,
    };

    const first = buildUrgentFingerprint(base);
    const second = buildUrgentFingerprint(base);
    const differentText = buildUrgentFingerprint({
      ...base,
      normalizedText: "urgent pickup later",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(differentText).not.toBe(first);
  });

  test("buildUrgentFingerprint uses a cooldown-based minute bucket", () => {
    const withinSameBucket = buildUrgentFingerprint({
      groupId: "grp_parents_001",
      normalizedText: "urgent pickup now",
      timestamp: "2026-03-25T10:04:59.000Z",
      cooldownMinutes: 5,
    });
    const sameBucket = buildUrgentFingerprint({
      groupId: "grp_parents_001",
      normalizedText: "urgent pickup now",
      timestamp: "2026-03-25T10:00:01.000Z",
      cooldownMinutes: 5,
    });
    const nextBucket = buildUrgentFingerprint({
      groupId: "grp_parents_001",
      normalizedText: "urgent pickup now",
      timestamp: "2026-03-25T10:05:00.000Z",
      cooldownMinutes: 5,
    });

    expect(withinSameBucket).toBe(sameBucket);
    expect(nextBucket).not.toBe(sameBucket);
  });

  test("pruneExpiredUrgentFingerprints removes expired entries and keeps valid ones", () => {
    const pruned = pruneExpiredUrgentFingerprints(
      [
        {
          fingerprint: "expired",
          seenAt: "2026-03-25T09:00:00.000Z",
          expiresAt: "2026-03-25T09:30:00.000Z",
        },
        {
          fingerprint: "active",
          seenAt: "2026-03-25T09:45:00.000Z",
          expiresAt: "2026-03-25T10:30:00.000Z",
        },
      ],
      "2026-03-25T10:00:00.000Z",
    );

    expect(pruned).toEqual([
      {
        fingerprint: "active",
        seenAt: "2026-03-25T09:45:00.000Z",
        expiresAt: "2026-03-25T10:30:00.000Z",
      },
    ]);
  });

  test("hasActiveUrgentFingerprint detects active, expired, and missing fingerprints", () => {
    const fingerprints = [
      {
        fingerprint: "active",
        seenAt: "2026-03-25T09:45:00.000Z",
        expiresAt: "2026-03-25T10:30:00.000Z",
      },
      {
        fingerprint: "expired",
        seenAt: "2026-03-25T09:00:00.000Z",
        expiresAt: "2026-03-25T09:30:00.000Z",
      },
    ];

    expect(
      hasActiveUrgentFingerprint(
        fingerprints,
        "active",
        "2026-03-25T10:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      hasActiveUrgentFingerprint(
        fingerprints,
        "expired",
        "2026-03-25T10:00:00.000Z",
      ),
    ).toBe(false);
    expect(
      hasActiveUrgentFingerprint(
        fingerprints,
        "missing",
        "2026-03-25T10:00:00.000Z",
      ),
    ).toBe(false);
  });

  test("rememberUrgentFingerprint adds a new entry and prunes expired entries", () => {
    const remembered = rememberUrgentFingerprint(
      [
        {
          fingerprint: "expired",
          seenAt: "2026-03-25T09:00:00.000Z",
          expiresAt: "2026-03-25T09:10:00.000Z",
        },
        {
          fingerprint: "keep",
          seenAt: "2026-03-25T09:50:00.000Z",
          expiresAt: "2026-03-25T10:20:00.000Z",
        },
      ],
      {
        fingerprint: "new",
        nowIso: "2026-03-25T10:00:00.000Z",
        cooldownMinutes: 30,
      },
    );

    expect(remembered).toEqual([
      {
        fingerprint: "new",
        seenAt: "2026-03-25T10:00:00.000Z",
        expiresAt: "2026-03-25T10:30:00.000Z",
      },
      {
        fingerprint: "keep",
        seenAt: "2026-03-25T09:50:00.000Z",
        expiresAt: "2026-03-25T10:20:00.000Z",
      },
    ]);
  });

  test("rememberUrgentFingerprint caps stored fingerprints at 2000 entries", () => {
    const existing = Array.from({ length: 2001 }, (_, index) => ({
      fingerprint: `fp-${index}`,
      seenAt: "2026-03-25T09:00:00.000Z",
      expiresAt: "2026-03-25T11:00:00.000Z",
    }));

    const remembered = rememberUrgentFingerprint(existing, {
      fingerprint: "newest",
      nowIso: "2026-03-25T10:00:00.000Z",
      cooldownMinutes: 30,
    });

    expect(remembered).toHaveLength(2000);
    expect(remembered[0]?.fingerprint).toBe("newest");
    expect(remembered.some((entry) => entry.fingerprint === "fp-2000")).toBe(
      false,
    );
  });
});
