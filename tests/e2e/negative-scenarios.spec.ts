import { test, expect, ElectronApplication, Page } from "@playwright/test";
import { ChildProcess } from "node:child_process";

import {
  ensureDashboard,
  launchApp,
  screenshot,
  startSimulatorForCurrentDaemon,
  toggleGroup,
  waitForGroupByName,
} from "./helpers";

test.describe.serial("QuietClaw - Negative Scenarios", () => {
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

  test("1. summary send stays disabled before any messages arrive", async () => {
    const sendButton = window.getByRole("button", { name: /send test summary/i });
    await expect(sendButton).toBeDisabled();

    const bodyText = await window.locator("body").innerText();
    expect(bodyText).toContain("Waiting for group messages before a summary can be generated.");
    await screenshot(window, "neg-01-summary-disabled-empty");
  });

  test("2. summary send stays disabled until a summary group is selected", async () => {
    simulator = startSimulatorForCurrentDaemon();
    await waitForGroupByName(window, "PTA Board");

    const sendButton = window.getByRole("button", { name: /send test summary/i });
    await expect(sendButton).toBeDisabled();

    const bodyText = await window.locator("body").innerText();
    expect(bodyText).toContain("Select at least one daily summary group.");
    await screenshot(window, "neg-02-summary-disabled-no-selection");
  });

  test("3. urgent-only selection does not enable daily summary send", async () => {
    await toggleGroup(window, "urgent", "PTA Board");

    const sendButton = window.getByRole("button", { name: /send test summary/i });
    await expect(sendButton).toBeDisabled();
    await screenshot(window, "neg-03-urgent-only");
  });
});
