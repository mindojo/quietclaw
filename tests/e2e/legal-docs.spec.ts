import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { clearConfigJsonFiles, resolvePackagedAppPath } from "./runtime";

const APP_PATH = resolvePackagedAppPath();

test.describe("Legal document buttons", () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(() => {
    clearConfigJsonFiles();
  });

  test.afterAll(async () => {
    if (app) await app.close().catch(() => {});
  });

  test("clicking Terms button triggers openLegalDocument IPC", async () => {
    app = await electron.launch({ executablePath: APP_PATH });
    page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Before you start")).toBeVisible({ timeout: 5000 });

    const termsBtn = page.getByRole("button", { name: "Terms" });
    await expect(termsBtn).toBeVisible();
    await termsBtn.click();
    await page.waitForTimeout(1000);

    expect(fs.existsSync(path.resolve("docs/legal/TERMS.md"))).toBe(true);
  });
});
