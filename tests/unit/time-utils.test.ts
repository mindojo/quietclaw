import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";

import {
  computeNextDigestRunAt,
  isSameLocalDay,
  minutesSince,
  parseDigestTimeParts,
  parseUtcIso,
} from "../../apps/desktop-monitor/src/main/util/time";

describe("time utilities", () => {
  test('parseDigestTimeParts parses "20:30"', () => {
    expect(parseDigestTimeParts("20:30")).toEqual({ hour: 20, minute: 30 });
  });

  test("parseDigestTimeParts throws for invalid input", () => {
    expect(() => parseDigestTimeParts("24:00")).toThrow("Invalid digest time");
    expect(() => parseDigestTimeParts("nope")).toThrow("Invalid digest time");
  });

  test("computeNextDigestRunAt returns a future time at the requested local clock time", () => {
    const zone = "America/New_York";
    const now = DateTime.fromISO("2026-03-25T19:45:00", { zone });

    const nextRunIso = computeNextDigestRunAt(now, "20:30");
    const nextRunLocal = parseUtcIso(nextRunIso).setZone(zone);

    expect(parseUtcIso(nextRunIso).toMillis()).toBeGreaterThan(now.toUTC().toMillis());
    expect(nextRunLocal.toFormat("HH:mm")).toBe("20:30");
    expect(nextRunLocal.toFormat("yyyy-LL-dd")).toBe("2026-03-25");
  });

  test("computeNextDigestRunAt rolls to the next local day after the scheduled time", () => {
    const zone = "Asia/Jerusalem";
    const now = DateTime.fromISO("2026-03-25T22:15:00", { zone });

    const nextRunLocal = parseUtcIso(computeNextDigestRunAt(now, "20:30")).setZone(
      zone,
    );

    expect(nextRunLocal.toFormat("yyyy-LL-dd HH:mm")).toBe("2026-03-26 20:30");
  });

  test("isSameLocalDay returns true for the same local day and false for different days", () => {
    const zone = "Europe/Berlin";
    const sameDayReference = DateTime.fromISO("2026-03-26T01:00:00", { zone });
    const differentDayReference = DateTime.fromISO("2026-03-27T01:00:00", { zone });

    expect(
      isSameLocalDay("2026-03-25T23:30:00.000Z", sameDayReference, zone),
    ).toBe(true);
    expect(
      isSameLocalDay("2026-03-25T23:30:00.000Z", differentDayReference, zone),
    ).toBe(false);
  });

  test("minutesSince computes whole elapsed minutes", () => {
    const reference = DateTime.fromISO("2026-03-25T12:30:00.000Z", { zone: "utc" });

    expect(minutesSince("2026-03-25T12:00:00.000Z", reference)).toBe(30);
  });
});
