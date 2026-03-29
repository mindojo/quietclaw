import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

const appPath = path.resolve(
  __dirname,
  "../../apps/desktop-monitor/out/QuietClaw-darwin-arm64/QuietClaw.app/Contents/MacOS/QuietClaw"
);

test("verify UI fixes with 30 groups", async () => {
  const electronApp = await electron.launch({
    executablePath: appPath,
    timeout: 30_000,
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await window.waitForTimeout(4000);

  // Debug: screenshot whatever state we're in
  await window.screenshot({ path: "test-results/verify-00-initial.png" });
  const bodyHtml = await window.locator("body").innerHTML();
  console.log("Body HTML length:", bodyHtml.length);
  console.log("Body text:", (await window.locator("body").innerText()).slice(0, 300));

  // Accept legal gate - try MUI Checkbox (role=checkbox)
  const muiCheckbox = window.locator('[role="checkbox"], input[type="checkbox"]').first();
  const checkboxCount = await muiCheckbox.count();
  console.log("Checkbox count:", checkboxCount);

  if (checkboxCount > 0) {
    await muiCheckbox.click();
    await window.waitForTimeout(500);

    const continueBtn = window.locator("button").filter({ hasText: /continue/i });
    const contCount = await continueBtn.count();
    console.log("Continue button count:", contCount);
    if (contCount > 0) {
      await continueBtn.click();
      await window.waitForTimeout(2000);
    }
  }

  await window.screenshot({ path: "test-results/verify-01-after-legal.png" });

  // Open settings
  const settingsBtn = window.locator('[aria-label*="etting"], [aria-label*="Setting"]').first();
  const settingsBtnCount = await settingsBtn.count();
  console.log("Settings button count:", settingsBtnCount);

  if (settingsBtnCount > 0) {
    await settingsBtn.click();
    await window.waitForTimeout(1000);
    await window.screenshot({ path: "test-results/verify-02-settings.png" });

    // Fill port and token
    const inputs = await window.locator("input").all();
    for (const input of inputs) {
      const inputType = await input.getAttribute("type").catch(() => "text");
      if (inputType === "password") {
        await input.fill("quietclaw-demo-token");
      }
    }

    // Find port input and set to 43123
    const portLabels = window.locator('label:has-text("Port")');
    if (await portLabels.count() > 0) {
      const portInput = window.locator('label:has-text("Port") + div input, label:has-text("Port") ~ div input').first();
      if (await portInput.count() > 0) {
        await portInput.fill("43123");
      }
    }

    await window.waitForTimeout(500);

    // Click Connect
    const connectBtn = window.locator("button").filter({ hasText: /^connect$/i }).first();
    if (await connectBtn.count() > 0) {
      await connectBtn.click();
      await window.waitForTimeout(3000);
    }

    await window.screenshot({ path: "test-results/verify-03-connected.png" });

    // Close settings
    await window.keyboard.press("Escape");
    await window.waitForTimeout(1500);
  }

  // Screenshot: main page with groups
  await window.screenshot({ path: "test-results/verify-04-main-connected.png" });

  // Try to click target group button
  const targetBtns = window.locator("button").filter({ hasText: /select target|target group/i });
  console.log("Target buttons:", await targetBtns.count());
  if (await targetBtns.count() > 0) {
    await targetBtns.first().click();
    await window.waitForTimeout(1000);
    await window.screenshot({ path: "test-results/verify-05-target-popup.png" });

    // Select My Alerts
    const alertsItem = window.locator('[role="dialog"] >> text=My Alerts').first();
    if (await alertsItem.count() > 0) {
      await alertsItem.click();
      await window.waitForTimeout(1000);
    } else {
      // Try any clickable item with "Alerts"
      const anyAlerts = window.locator('text=My Alerts').first();
      if (await anyAlerts.count() > 0) {
        await anyAlerts.click();
        await window.waitForTimeout(1000);
      }
    }
  }

  await window.screenshot({ path: "test-results/verify-06-target-selected.png" });

  // Final body text
  const finalText = await window.locator("body").innerText();
  console.log("Final page text (300 chars):", finalText.slice(0, 300));

  await electronApp.close();
});
