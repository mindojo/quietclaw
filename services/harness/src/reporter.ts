import fs from "node:fs";
import path from "node:path";

import type { RunResult } from "./types.js";

const RESULTS_DIR = path.resolve("services/harness/results");

export function writeRunReport(result: RunResult): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const baseName = `${result.scenario_id}`;
  fs.writeFileSync(
    path.join(RESULTS_DIR, `${baseName}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(RESULTS_DIR, `${baseName}.md`), toMarkdown(result));
}

function toMarkdown(result: RunResult): string {
  const lines = [
    `# ${result.scenario_id}`,
    "",
    `passed: ${result.passed}`,
    `duration_ms: ${result.duration_ms}`,
    "",
    "## Assertions",
    "",
    ...result.assertions.map((assertionResult) =>
      `- ${assertionResult.passed ? "PASS" : "FAIL"} ${JSON.stringify(assertionResult.assertion)} :: ${assertionResult.detail}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
