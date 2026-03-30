import {
  test,
  expect,
  ElectronApplication,
  Page,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { ensureDashboard, launchApp, openSettings } from "./helpers";

const SCREENSHOT_DIR = path.resolve("test-results/settings-ai-test");

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

test.describe.serial("Settings - AI Provider Selection & Test", () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ensureScreenshotDir();
    const launched = await launchApp({ seedOnboarded: true });
    app = launched.electronApp;
    page = launched.window;
    await ensureDashboard(page);
    await openSettings(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => {});
  });

  test("01 - settings renders AI provider cards", async () => {
    await expect(page.locator("button.settings-provider-card").filter({ hasText: "Claude CLI" })).toBeVisible();
    await expect(page.locator("button.settings-provider-card").filter({ hasText: "Codex CLI" })).toBeVisible();
    await shot(page, "01-settings-initial");
  });

  test("02 - Claude CLI is selected by default", async () => {
    const claudeCard = page.locator("button.settings-provider-card").filter({ hasText: "Claude CLI" });
    await expect(claudeCard).toHaveClass(/selected/);

    const options = await page.locator("#settings-model option").allTextContents();
    expect(options.some((option) => option.toLowerCase().includes("haiku"))).toBe(true);
    expect(options.some((option) => option.toLowerCase().includes("sonnet"))).toBe(true);
    expect(options.some((option) => option.toLowerCase().includes("opus"))).toBe(true);
  });

  test("03 - switching to Codex updates selection and model options", async () => {
    const codexCard = page.locator("button.settings-provider-card").filter({ hasText: "Codex CLI" });
    await codexCard.click();
    await expect(codexCard).toHaveClass(/selected/);

    const options = await page.locator("#settings-model option").allTextContents();
    expect(options.some((option) => option.toLowerCase().includes("gpt-5.4"))).toBe(true);
    expect(options.some((option) => option.toLowerCase().includes("haiku"))).toBe(false);
    await shot(page, "03-codex-selected");
  });
});
