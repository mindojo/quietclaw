import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  retries: 0,
  workers: 1,
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
  },
  testIgnore: ["**/placeholder*", "**/quick-verify*"],
});
