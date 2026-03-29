import type { AppConfig } from "../config/schema";
import { sha256Hex } from "../util/hashing";
import { parseUtcIso } from "../util/time";

export function buildUrgentFingerprint(input: {
  groupId: string;
  normalizedText: string;
  timestamp: string;
  cooldownMinutes: number;
}): string {
  const timestampMs = parseUtcIso(input.timestamp).toMillis();
  const minuteBucket = Math.floor(
    timestampMs / (input.cooldownMinutes * 60 * 1000),
  );

  return sha256Hex(`${input.groupId}|${input.normalizedText}|${minuteBucket}`);
}

export function pruneExpiredUrgentFingerprints(
  fingerprints: AppConfig["dedupe"]["urgentFingerprints"],
  nowIso: string,
): AppConfig["dedupe"]["urgentFingerprints"] {
  const nowMs = parseUtcIso(nowIso).toMillis();
  return fingerprints.filter((entry) => parseUtcIso(entry.expiresAt).toMillis() > nowMs);
}

export function hasActiveUrgentFingerprint(
  fingerprints: AppConfig["dedupe"]["urgentFingerprints"],
  fingerprint: string,
  nowIso: string,
): boolean {
  const nowMs = parseUtcIso(nowIso).toMillis();

  return fingerprints.some((entry) => {
    if (entry.fingerprint !== fingerprint) {
      return false;
    }

    return parseUtcIso(entry.expiresAt).toMillis() > nowMs;
  });
}

export function rememberUrgentFingerprint(
  fingerprints: AppConfig["dedupe"]["urgentFingerprints"],
  input: {
    fingerprint: string;
    nowIso: string;
    cooldownMinutes: number;
  },
): AppConfig["dedupe"]["urgentFingerprints"] {
  const seenAt = parseUtcIso(input.nowIso);
  const expiresAt = seenAt.plus({ minutes: input.cooldownMinutes }).toISO() ?? input.nowIso;
  const nextEntries = pruneExpiredUrgentFingerprints(fingerprints, input.nowIso).filter(
    (entry) => entry.fingerprint !== input.fingerprint,
  );

  return [
    {
      fingerprint: input.fingerprint,
      seenAt: input.nowIso,
      expiresAt,
    },
    ...nextEntries,
  ].slice(0, 2000);
}
