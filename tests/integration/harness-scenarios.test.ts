import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { runScenarioFile } from "../../services/harness/src/runner.js";

const scenariosDir = path.resolve("services/harness/scenarios");
const scenarioFiles = fs
  .readdirSync(scenariosDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

describe("harness scenarios", () => {
  test.each(scenarioFiles)("%s", async (fileName) => {
    const result = await runScenarioFile(path.join(scenariosDir, fileName));
    expect(result.passed).toBe(true);
  });
});
