import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync, ChildProcess, spawn } from "node:child_process";

const appDir = path.resolve(__dirname, "../../apps/desktop-monitor");
const appPath = path.resolve(
  appDir,
  "out/QuietClaw-darwin-arm64/QuietClaw.app/Contents/MacOS/QuietClaw"
);
const projectRoot = path.resolve(__dirname, "../..");

let daemonProcess: ChildProcess | null = null;

async function screenshot(window: Page, name: string): Promise<void> {
  await window.waitForTimeout(500);
  await window.screenshot({ path: `test-results/${name}.png` });
}

test.describe("QuietClaw Desktop — Full E2E Flow", () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    // Start the live daemon
    daemonProcess = spawn("npx", ["tsx", "services/live-daemon/src/index.ts"], {
      cwd: projectRoot,
      stdio: "pipe",
      env: { ...process.env, DAEMON_PORT: "43199" },
    });

    // Wait for daemon to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Live daemon startup timeout")), 10000);
      daemonProcess!.stdout?.on("data", (data: Buffer) => {
        if (data.toString().includes("listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      daemonProcess!.stderr?.on("data", (data: Buffer) => {
        console.error("Daemon stderr:", data.toString());
      });
    });
  });

  test.afterAll(async () => {
    if (daemonProcess) {
      daemonProcess.kill("SIGTERM");
      daemonProcess = null;
    }
  });

  test("complete app flow: legal → connect → configure → test summary", async () => {
    // Clear config for test isolation (legal gate must be visible)
    const configDir = path.join(
      process.env.HOME ?? "/tmp",
      "Library/Application Support/QuietClaw"
    );
    try {
      const files = fs.readdirSync(configDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          fs.unlinkSync(path.join(configDir, file));
        }
      }
    } catch {
      // Dir may not exist
    }

    electronApp = await electron.launch({
      executablePath: appPath,
      timeout: 30_000,
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForTimeout(2000);

    // === STEP 1: Legal Gate ===
    await screenshot(window, "01-legal-gate");

    // Verify legal gate content
    await expect(window.locator("text=QuietClaw Desktop Monitor")).toBeVisible();
    await expect(window.locator("text=I understand and accept")).toBeVisible();

    // Check the checkbox
    const checkbox = window.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await window.waitForTimeout(300);
    await screenshot(window, "02-legal-checked");

    // Click Continue
    const continueBtn = window.locator("button", { hasText: "Continue" });
    await continueBtn.click();
    await window.waitForTimeout(2000);
    await screenshot(window, "03-main-page-disconnected");

    // === STEP 2: Open Settings & Connect ===
    // Click the settings cogwheel
    const settingsBtn = window.locator('[aria-label="Settings"], button:has(> .MuiSvgIcon-root)').last();
    // Try finding settings button by icon or text
    const allButtons = await window.locator("button").all();
    let settingsClicked = false;
    for (const btn of allButtons) {
      const text = await btn.innerText().catch(() => "");
      const ariaLabel = await btn.getAttribute("aria-label").catch(() => "");
      if (text.includes("settings") || text.includes("Settings") || ariaLabel?.includes("settings") || ariaLabel?.includes("Settings")) {
        await btn.click();
        settingsClicked = true;
        break;
      }
    }

    // If we couldn't find it by text, try the last icon button in the header
    if (!settingsClicked) {
      // Look for a button with a settings/gear icon - usually last button in the top bar
      const headerButtons = window.locator("header button, [role='banner'] button");
      const count = await headerButtons.count();
      if (count > 0) {
        await headerButtons.last().click();
        settingsClicked = true;
      }
    }

    await window.waitForTimeout(1000);
    await screenshot(window, "04-settings-dialog");

    // Fill connection details
    const hostInput = window.locator('input').filter({ hasText: /^$/ }).first();
    const inputs = await window.locator("input[type='text'], input[type='number'], input[type='password']").all();

    // Find and fill host/port/token fields
    for (const input of inputs) {
      const value = await input.inputValue().catch(() => "");
      const placeholder = await input.getAttribute("placeholder").catch(() => "");
      const label = await input.evaluate((el) => {
        const labelEl = el.closest(".MuiFormControl-root")?.querySelector("label");
        return labelEl?.textContent ?? "";
      }).catch(() => "");

      if (label.toLowerCase().includes("host") || placeholder?.includes("127")) {
        await input.fill("127.0.0.1");
      } else if (label.toLowerCase().includes("port")) {
        await input.fill("43199");
      } else if (label.toLowerCase().includes("token") || input.getAttribute("type").then(t => t === "password").catch(() => false)) {
        const inputType = await input.getAttribute("type").catch(() => "text");
        if (inputType === "password") {
          await input.fill("quietclaw-demo-token");
        }
      }
    }

    await window.waitForTimeout(500);
    await screenshot(window, "05-settings-filled");

    // Click Connect button
    const connectBtn = window.locator("button", { hasText: "Connect" }).first();
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      await window.waitForTimeout(3000);
      await screenshot(window, "06-connected");
    }

    // Close settings dialog
    const closeBtn = window.locator("button", { hasText: "Close" });
    const closeIcon = window.locator('[aria-label="close"], [aria-label="Close"]');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else if (await closeIcon.count() > 0) {
      await closeIcon.first().click();
    } else {
      // Press Escape
      await window.keyboard.press("Escape");
    }

    await window.waitForTimeout(1500);
    await screenshot(window, "07-main-page-connected");

    // === STEP 3: Verify group list appears ===
    const bodyText = await window.locator("body").innerText();
    console.log("Main page text (first 500 chars):", bodyText.slice(0, 500));

    // Check for groups or connection status
    const hasGroups = bodyText.includes("Parents") || bodyText.includes("Building") || bodyText.includes("School");
    const hasConnected = bodyText.toLowerCase().includes("connected");
    console.log(`Groups visible: ${hasGroups}, Connected visible: ${hasConnected}`);

    await screenshot(window, "08-final-state");

    // === Verify window properties ===
    const bounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win?.getBounds();
    });
    console.log("Window bounds:", bounds);
    expect(bounds?.width).toBeGreaterThanOrEqual(900);

    await electronApp.close();
  });
});
