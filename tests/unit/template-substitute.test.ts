import { describe, expect, it } from "vitest";

import { substituteTemplate } from "../../apps/desktop-monitor/src/main/util/templateSubstitute";

describe("substituteTemplate", () => {
  it("replaces known variables", () => {
    expect(substituteTemplate("Hello {{name}}", { name: "World" })).toBe("Hello World");
  });

  it("leaves unknown variables untouched", () => {
    expect(substituteTemplate("Hello {{unknown}}", {})).toBe("Hello {{unknown}}");
  });

  it("replaces multiple variables", () => {
    expect(substituteTemplate("{{a}} and {{b}}", { a: "X", b: "Y" })).toBe("X and Y");
  });

  it("handles empty template", () => {
    expect(substituteTemplate("", { a: "X" })).toBe("");
  });
});
