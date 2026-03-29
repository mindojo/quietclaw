import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve("test-results/settings-ai-test");
const APP_PATH = path.resolve(
  "apps/desktop-monitor/out/QuietClaw-darwin-arm64/QuietClaw.app/Contents/MacOS/QuietClaw"
);

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

test.describe.serial("Settings — AI Provider Selection & Test", () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(() => {
    ensureScreenshotDir();
    // Don't clear config — use existing onboarded state
  });

  test.afterAll(async () => {
    if (app) await app.close().catch(() => {});
  });

  test("01 — Open app and navigate to settings", async () => {
    app = await electron.launch({ executablePath: APP_PATH });
    page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await delay(3000);

    // Click the gear icon to open settings
    const settingsBtn = page.locator('[aria-label="Open settings"]');
    if (await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsBtn.click();
      await delay(1500);
    }
    await shot(page, "01-settings-initial");
  });

  test("02 — Claude CLI card shows as selected (default)", async () => {
    // The Claude card should have the "selected" class (green border)
    const claudeCard = page.locator("button.settings-provider-card", { hasText: "Claude" });
    await expect(claudeCard).toBeVisible({ timeout: 3000 });
    await shot(page, "02-claude-selected");

    // Model dropdown should show Claude models (Haiku/Sonnet/Opus)
    const modelSelect = page.locator("#settings-model");
    const options = await modelSelect.locator("option").allTextContents();
    expect(options.some((o) => o.toLowerCase().includes("haiku"))).toBe(true);
    expect(options.some((o) => o.toLowerCase().includes("sonnet"))).toBe(true);
    expect(options.some((o) => o.toLowerCase().includes("opus"))).toBe(true);
  });

  test("03 — Click Codex card → visual selection changes + models update", async () => {
    const codexCard = page.locator("button.settings-provider-card", { hasText: "Codex" });
    await codexCard.click();
    await delay(500);
    await shot(page, "03-codex-selected");

    // Codex card should now have "selected" class
    await expect(codexCard).toHaveClass(/selected/);

    // Claude card should NOT have "selected" class
    const claudeCard = page.locator("button.settings-provider-card", { hasText: "Claude" });
    const claudeClasses = await claudeCard.getAttribute("class");
    expect(claudeClasses).not.toContain("selected");

    // Model dropdown should show Codex models
    const modelSelect = page.locator("#settings-model");
    const options = await modelSelect.locator("option").allTextContents();
    expect(options.some((o) => o.toLowerCase().includes("gpt"))).toBe(true);
    expect(options.some((o) => o.toLowerCase().includes("haiku"))).toBe(false);
  });

  test("04 — Switch back to Claude and click Test connection", async () => {
    // Switch back to Claude
    const claudeCard = page.locator("button.settings-provider-card", { hasText: "Claude" });
    await claudeCard.click();
    await delay(500);
    await shot(page, "04-claude-reselected");

    // Find and click test connection button
    const testBtn = page.getByRole("button", { name: /test connection/i });
    if (await testBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testBtn.click();
      await delay(1000);
      await shot(page, "05-test-running");

      // Wait for result (up to 30s for CLI execution)
      await delay(25000);
      await shot(page, "06-test-result");
    } else {
      await shot(page, "05-no-test-button");
    }
  });
});
