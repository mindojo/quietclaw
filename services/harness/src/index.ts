import path from "node:path";

import { runScenarioFile } from "./runner.js";

async function main(): Promise<void> {
  const scenarioArgIndex = process.argv.findIndex((value) => value === "--scenario");
  if (scenarioArgIndex === -1 || !process.argv[scenarioArgIndex + 1]) {
    throw new Error("Usage: tsx src/index.ts --scenario scenarios/<file>.json");
  }

  const scenarioPath = path.resolve(process.cwd(), process.argv[scenarioArgIndex + 1]!);
  const result = await runScenarioFile(scenarioPath);
  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
