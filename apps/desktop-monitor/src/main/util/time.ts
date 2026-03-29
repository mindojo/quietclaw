import { DateTime } from "luxon";

const DIGEST_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
let nowOverride: (() => DateTime) | null = null;

export function nowUtc(): DateTime {
  return nowOverride ? nowOverride() : DateTime.utc();
}

export function nowIso(): string {
  return nowUtc().toISO() ?? new Date().toISOString();
}

export function setNowOverride(factory: (() => DateTime) | null): void {
  nowOverride = factory;
}

export function parseUtcIso(value: string): DateTime {
  return DateTime.fromISO(value, { zone: "utc" });
}

export function nowInTimeZone(timeZone: string): DateTime {
  return nowUtc().setZone(timeZone);
}

export function toDayKey(value: DateTime): string {
  return value.toFormat("yyyy-LL-dd");
}

export function startOfWindow(hours: number, reference = nowUtc()): DateTime {
  return reference.minus({ hours });
}

export function parseDigestTimeParts(value: string): { hour: number; minute: number } {
  const match = DIGEST_TIME_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Invalid digest time: ${value}`);
  }

  return {
    hour: Number.parseInt(match[1] ?? "0", 10),
    minute: Number.parseInt(match[2] ?? "0", 10),
  };
}

export function setLocalTime(value: DateTime, hhmm: string): DateTime {
  const { hour, minute } = parseDigestTimeParts(hhmm);
  return value.set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
}

export function computeNextDigestRunAt(now: DateTime, digestTimeLocal: string): string {
  const scheduledToday = setLocalTime(now, digestTimeLocal);
  const nextRun = now < scheduledToday
    ? scheduledToday
    : scheduledToday.plus({ days: 1 });

  return nextRun.toUTC().toISO() ?? nowIso();
}

export function isSameLocalDay(
  leftIso: string | null,
  right: DateTime,
  timeZone: string,
): boolean {
  if (!leftIso) {
    return false;
  }

  const left = parseUtcIso(leftIso).setZone(timeZone);
  return left.isValid && toDayKey(left) === toDayKey(right.setZone(timeZone));
}

export function formatLocalTimestamp(
  iso: string,
  timeZone: string,
  format = "yyyy-LL-dd HH:mm z",
): string {
  const local = parseUtcIso(iso).setZone(timeZone);
  return local.isValid ? local.toFormat(format) : iso;
}

export function minutesSince(iso: string, reference = nowUtc()): number {
  const then = parseUtcIso(iso);

  if (!then.isValid) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.floor(reference.diff(then, "minutes").minutes));
}
