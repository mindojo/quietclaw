/**
 * Debug test: step-by-step with screenshots at every action to understand
 * the actual UI state and fix selectors.
 */
import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { ChildProcess, spawn } from "node:child_process";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const APP_PATH = path.resolve(
  PROJECT_ROOT,
  "apps/desktop-monitor/out/QuietClaw-darwin-arm64/QuietClaw.app/Contents/MacOS/QuietClaw"
);

let daemonProcess: ChildProcess;

test.beforeAll(async () => {
  daemonProcess = spawn("npx", ["tsx", "services/live-daemon/src/index.ts"], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    env: { ...process.env, DAEMON_PORT: "43220" },
  });
  await new Promise<void>((resolve) => {
    daemonProcess.stdout?.on("data", (d: Buffer) => {
      if (d.toString().includes("listening")) resolve();
    });
  });
});

test.afterAll(async () => {
  daemonProcess?.kill("SIGTERM");
});

test("debug full flow", async () => {
  // Clean config
  const configDir = path.join(process.env.HOME ?? "/tmp", "Library/Application Support/QuietClaw");
  try {
    for (const f of fs.readdirSync(configDir)) {
      if (f.endsWith(".json")) fs.unlinkSync(path.join(configDir, f));
    }
  } catch {}

  const electronApp = await electron.launch({
    executablePath: APP_PATH,
    timeout: 30_000,
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await window.waitForTimeout(3000);

  // Step 1: Legal gate
  await window.screenshot({ path: "test-results/dbg-01-initial.png" });
  console.log("=== STEP 1: LEGAL GATE ===");
  console.log("Body text:", (await window.locator("body").innerText()).slice(0, 200));

  // Click "I understand and accept"
  await window.locator("text=I understand and accept").click();
  await window.waitForTimeout(500);
  await window.screenshot({ path: "test-results/dbg-02-checked.png" });

  // Click Continue
  await window.locator("button").filter({ hasText: /continue/i }).click();
  await window.waitForTimeout(2000);
  await window.screenshot({ path: "test-results/dbg-03-main.png" });
  console.log("=== STEP 2: MAIN PAGE ===");
  console.log("Body text:", (await window.locator("body").innerText()).slice(0, 300));

  // Step 2: Open settings
  console.log("=== Looking for settings button ===");
  const allButtons = await window.locator("button").all();
  for (let i = 0; i < allButtons.length; i++) {
    const text = await allButtons[i].innerText().catch(() => "");
    const ariaLabel = await allButtons[i].getAttribute("aria-label").catch(() => "");
    const visible = await allButtons[i].isVisible().catch(() => false);
    if (text || ariaLabel) {
      console.log(`  Button ${i}: text="${text.trim()}" aria-label="${ariaLabel}" visible=${visible}`);
    }
  }

  // Click settings
  const settingsBtn = window.locator('[aria-label="Open settings"]').first();
  console.log("Settings button count:", await settingsBtn.count());
  await settingsBtn.click();
  await window.waitForTimeout(1000);
  await window.screenshot({ path: "test-results/dbg-04-settings.png" });

  console.log("=== STEP 3: SETTINGS DIALOG ===");
  const settingsText = await window.locator("body").innerText();
  console.log("Settings text:", settingsText.slice(0, 500));

  // Find all inputs
  const allInputs = await window.locator("input").all();
  for (let i = 0; i < allInputs.length; i++) {
    const type = await allInputs[i].getAttribute("type").catch(() => "?");
    const value = await allInputs[i].inputValue().catch(() => "?");
    const placeholder = await allInputs[i].getAttribute("placeholder").catch(() => "");
    const disabled = await allInputs[i].isDisabled().catch(() => false);
    const label = await allInputs[i].evaluate((el) => {
      const ctrl = el.closest(".MuiFormControl-root");
      return ctrl?.querySelector("label")?.textContent ?? "(no label)";
    }).catch(() => "(err)");
    console.log(`  Input ${i}: type=${type} value="${value}" placeholder="${placeholder}" label="${label}" disabled=${disabled}`);
  }

  // Find all buttons in settings
  console.log("=== Settings buttons ===");
  const settingsBtns = await window.locator("button").all();
  for (let i = 0; i < settingsBtns.length; i++) {
    const text = await settingsBtns[i].innerText().catch(() => "");
    const visible = await settingsBtns[i].isVisible().catch(() => false);
    const disabled = await settingsBtns[i].isDisabled().catch(() => false);
    if (text.trim() && visible) {
      console.log(`  Button ${i}: "${text.trim()}" disabled=${disabled}`);
    }
  }

  // Fill port
  for (const input of allInputs) {
    const label = await input.evaluate((el) => {
      const ctrl = el.closest(".MuiFormControl-root");
      return ctrl?.querySelector("label")?.textContent ?? "";
    }).catch(() => "");
    const type = await input.getAttribute("type").catch(() => "");

    if (label.toLowerCase().includes("port")) {
      await input.clear();
      await input.fill("43220");
      console.log("Filled port: 43220");
    } else if (type === "password") {
      await input.fill("quietclaw-demo-token");
      console.log("Filled token");
    }
  }

  await window.waitForTimeout(300);
  await window.screenshot({ path: "test-results/dbg-05-filled.png" });

  // Click Connect — try multiple selectors
  const connectBtns = await window.locator("button").all();
  for (const btn of connectBtns) {
    const text = (await btn.innerText().catch(() => "")).trim().toLowerCase();
    if (text === "connect") {
      console.log("Found Connect button, clicking...");
      await btn.click();
      break;
    }
  }

  await window.waitForTimeout(4000);
  await window.screenshot({ path: "test-results/dbg-06-after-connect.png" });
  console.log("=== AFTER CONNECT ===");
  console.log("Body text:", (await window.locator("body").innerText()).slice(0, 300));

  // Close settings
  await window.keyboard.press("Escape");
  await window.waitForTimeout(1000);
  await window.screenshot({ path: "test-results/dbg-07-main-connected.png" });
  console.log("=== MAIN PAGE CONNECTED ===");
  const mainText = await window.locator("body").innerText();
  console.log("Body text:", mainText.slice(0, 500));

  // Click target group button
  console.log("=== Looking for target button ===");
  const btns2 = await window.locator("button").all();
  for (let i = 0; i < btns2.length; i++) {
    const text = (await btns2[i].innerText().catch(() => "")).trim();
    const visible = await btns2[i].isVisible().catch(() => false);
    if (visible && text.length > 0 && text.length < 50) {
      console.log(`  Button ${i}: "${text}"`);
    }
  }

  // Find and click the target group button
  const targetBtn = window.locator("button").filter({ hasText: "Select target group" }).first();
  const targetBtnCount = await targetBtn.count();
  console.log("Target button count:", targetBtnCount);
  if (targetBtnCount > 0) {
    await targetBtn.click();
    await window.waitForTimeout(1000);
    await window.screenshot({ path: "test-results/dbg-08-target-popup.png" });

    // Select My Alerts
    const dialog = window.locator('[role="dialog"]');
    console.log("Dialog visible:", await dialog.isVisible().catch(() => false));
    const dialogText = await dialog.innerText().catch(() => "no dialog");
    console.log("Dialog text:", dialogText.slice(0, 300));

    const myAlerts = dialog.locator("text=My Alerts").first();
    if (await myAlerts.count() > 0) {
      await myAlerts.click();
      await window.waitForTimeout(1000);
    }
  }

  await window.screenshot({ path: "test-results/dbg-09-target-selected.png" });
  console.log("=== FINAL STATE ===");
  console.log("Body:", (await window.locator("body").innerText()).slice(0, 400));

  await electronApp.close();
});
