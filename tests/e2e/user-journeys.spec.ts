import { test, expect, ElectronApplication, Page } from "@playwright/test";
import { ChildProcess } from "node:child_process";

import {
  ensureDashboard,
  launchApp,
  openSettings,
  screenshot,
  startSimulatorForCurrentDaemon,
  toggleGroup,
  waitForGroupByName,
} from "./helpers";

test.describe.serial("QuietClaw - Standard User Journeys", () => {
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

  test("1. onboarded app opens directly on the dashboard", async () => {
    const bodyText = await window.locator("body").innerText();
    expect(bodyText).toContain("Watched groups");
    expect(bodyText).toContain("Waiting for messages");
    await screenshot(window, "uj-01-dashboard-empty");
  });

  test("2. simulator hydrates groups into the live daemon", async () => {
    simulator = startSimulatorForCurrentDaemon();
    await waitForGroupByName(window, "PTA Board");

    const bodyText = await window.locator("body").innerText();
    expect(bodyText).toContain("PTA Board");
    await screenshot(window, "uj-02-groups-hydrated");
  });

  test("3. selecting a summary group enables manual summary send", async () => {
    await toggleGroup(window, "summary", "PTA Board");

    const sendButton = window.getByRole("button", { name: /send test summary/i });
    await expect(sendButton).toBeEnabled();
    await screenshot(window, "uj-03-summary-enabled");
  });

  test("4. settings open from the dashboard and expose AI provider controls", async () => {
    await openSettings(window);

    await expect(window.locator("p.settings-label").filter({ hasText: "AI provider" })).toBeVisible();
    await expect(window.locator("button.settings-provider-card").filter({ hasText: "Claude CLI" })).toBeVisible();
    await expect(window.locator("button.settings-provider-card").filter({ hasText: "Codex CLI" })).toBeVisible();
    await screenshot(window, "uj-04-settings");
  });
});
