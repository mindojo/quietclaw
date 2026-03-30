import {
  test,
  expect,
  ElectronApplication,
  Page,
} from "@playwright/test";
import { ChildProcess } from "node:child_process";

import {
  clickSendTestSummary,
  ensureDashboard,
  launchApp,
  openSettings,
  screenshot,
  startSimulatorForCurrentDaemon,
} from "./helpers";

test.describe.serial("QuietClaw Desktop - Full E2E Flow", () => {
  let simulator: ChildProcess | null = null;
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    const app = await launchApp({ seedOnboarded: true });
    electronApp = app.electronApp;
    window = app.window;
    await ensureDashboard(window);
  });

  test.afterAll(async () => {
    simulator?.kill("SIGTERM");
    await electronApp?.close();
  });

  test("dashboard -> simulator groups -> select summary -> open settings", async () => {
    simulator = startSimulatorForCurrentDaemon();
    const firstSummaryToggle = window.locator('button[aria-label^="Toggle summary for"]').first();
    await expect(firstSummaryToggle).toBeVisible({ timeout: 20_000 });
    await firstSummaryToggle.click();
    await window.waitForTimeout(500);

    const sendButton = window.getByRole("button", { name: /send test summary/i });
    await expect(sendButton).toBeEnabled();

    await clickSendTestSummary(window);
    await screenshot(window, "full-01-summary-requested");

    await openSettings(window);
    await expect(window.locator("p.settings-label").filter({ hasText: "AI provider" })).toBeVisible();
    await screenshot(window, "full-02-settings");
  });
});
