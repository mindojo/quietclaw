import { describe, expect, test } from "vitest";

import { sha256Hex } from "../../apps/desktop-monitor/src/main/util/hashing";

describe("sha256Hex", () => {
  test("produces a 64-character hex string", () => {
    expect(sha256Hex("quietclaw")).toMatch(/^[0-9a-f]{64}$/u);
  });

  test("returns the same hash for the same input", () => {
    expect(sha256Hex("same input")).toBe(sha256Hex("same input"));
  });

  test("returns different hashes for different input", () => {
    expect(sha256Hex("input one")).not.toBe(sha256Hex("input two"));
  });
});
