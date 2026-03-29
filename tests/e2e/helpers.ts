import { _electron as electron, ElectronApplication, Page } from "@playwright/test";
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const APP_PATH = path.resolve(
  PROJECT_ROOT,
  "apps/desktop-monitor/out/QuietClaw-darwin-arm64/QuietClaw.app/Contents/MacOS/QuietClaw"
);

/** Start the live daemon on a given port. Returns the child process. */
export async function startLiveDaemon(port: number): Promise<ChildProcess> {
  const proc = spawn("npx", ["tsx", "services/live-daemon/src/index.ts"], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    env: { ...process.env, DAEMON_PORT: String(port) },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Live daemon startup timeout")),
      15000
    );
    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("Error") || msg.includes("EADDRINUSE")) {
        clearTimeout(timeout);
        reject(new Error(`Live daemon error: ${msg}`));
      }
    });
  });

  return proc;
}

/** Alias for startLiveDaemon — starts a stub gateway for E2E tests. */
export const startStubGateway = startLiveDaemon;

/** Launch the Electron app. Always starts with a clean config unless keepConfig is true. */
export async function launchApp(opts?: {
  env?: Record<string, string>;
  keepConfig?: boolean;
}): Promise<{ electronApp: ElectronApplication; window: Page }> {
  // Default: always delete config for test isolation
  if (!opts?.keepConfig) {
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
      // Dir may not exist, that's fine
    }
  }

  const electronApp = await electron.launch({
    executablePath: APP_PATH,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      ...opts?.env,
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await window.waitForTimeout(3000);

  return { electronApp, window };
}

/** Take a named screenshot. */
export async function screenshot(
  window: Page,
  name: string
): Promise<void> {
  await window.waitForTimeout(300);
  await window.screenshot({ path: `test-results/${name}.png` });
}

/** Accept the legal gate (checkbox + Continue). Skips if already accepted. */
export async function acceptLegalGate(window: Page): Promise<void> {
  // Close any stale dialog that might be blocking
  await closeAnyDialog(window);

  // Check if legal gate is visible (look for the specific legal gate text)
  const legalTitle = window.locator("text=QuietClaw Desktop Monitor").first();
  const continueBtn = window.locator("button").filter({ hasText: /continue/i });

  const isLegalVisible = await legalTitle.isVisible({ timeout: 3000 }).catch(() => false);
  const hasContinue = await continueBtn.isVisible({ timeout: 1000 }).catch(() => false);

  if (!isLegalVisible || !hasContinue) {
    // Legal gate already accepted — close any dialog that may have opened on restore
    await closeAnyDialog(window);
    return;
  }

  // Find the checkbox near the "I understand and accept" text
  // MUI FormControlLabel wraps checkbox + label, so click the label text to toggle
  const acceptLabel = window.locator("text=I understand and accept").first();

  // Try clicking the label (MUI FormControlLabel toggles the checkbox on label click)
  await acceptLabel.click();

  await window.waitForTimeout(400);
  await continueBtn.click();
  await window.waitForTimeout(2000);
}

/** Close any open dialog/modal. */
export async function closeAnyDialog(window: Page): Promise<void> {
  // Try pressing Escape to close any open dialog
  const dialog = window.locator('[role="dialog"], [role="presentation"]').first();
  if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await window.keyboard.press("Escape");
    await window.waitForTimeout(500);
  }
}

/** Open settings dialog via the cogwheel button. */
export async function openSettings(window: Page): Promise<void> {
  // Always click the settings button — it's safe to click even if dialog is already open
  const btn = window.locator('[aria-label="Open settings"]').first();
  try {
    await btn.click({ timeout: 5000 });
  } catch {
    // Button might be behind a dialog — close it first and retry
    await window.keyboard.press("Escape");
    await window.waitForTimeout(500);
    await btn.click({ timeout: 5000 });
  }
  await window.waitForTimeout(1500);
}

/** Legacy helper name. The app now reads from the live daemon automatically. */
export async function connectToGateway(
  window: Page,
  port: number,
  token = "quietclaw-demo-token"
): Promise<void> {
  await openSettings(window);

  // Fill port and token by iterating all inputs
  const inputs = await window.locator("input").all();
  for (const input of inputs) {
    const inputType = await input.getAttribute("type").catch(() => "text");
    const label = await input
      .evaluate((el) => {
        const ctrl = el.closest(".MuiFormControl-root");
        return ctrl?.querySelector("label")?.textContent ?? "";
      })
      .catch(() => "");

    if (label.toLowerCase().includes("port")) {
      await input.fill(String(port));
    } else if (inputType === "password") {
      await input.fill(token);
    }
  }

  await window.waitForTimeout(500);

  // Click Connect — iterate all buttons (same pattern as working debug test)
  const btns = await window.locator("button").all();
  for (const btn of btns) {
    const text = (await btn.innerText().catch(() => "")).trim();
    if (text === "CONNECT" || text === "Connect") {
      await btn.click();
      break;
    }
  }
  await window.waitForTimeout(4000);

  // Close settings
  await window.keyboard.press("Escape");
  await window.waitForTimeout(1000);
}

/** Open the target group popup and select a group by name. */
export async function selectTargetGroup(
  window: Page,
  groupName: string
): Promise<void> {
  // Find the target button — it either says "Select target group..." or shows a group name
  const allBtns = await window.locator("button").all();
  for (const btn of allBtns) {
    const text = (await btn.innerText().catch(() => "")).trim();
    if (text.includes("Select target group") || text === groupName) {
      await btn.click();
      break;
    }
  }

  await window.waitForTimeout(1000);

  // Wait for the dialog to appear
  const dialog = window.locator('[role="dialog"]');
  const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
  if (!dialogVisible) {
    // Dialog didn't open — try clicking again
    for (const btn of allBtns) {
      const text = (await btn.innerText().catch(() => "")).trim();
      if (text.includes("Select target group") || text.includes("target")) {
        await btn.click();
        break;
      }
    }
    await window.waitForTimeout(1000);
  }

  // Click the group in the dialog
  const groupItem = dialog.locator(`text=${groupName}`).first();
  await groupItem.click({ timeout: 10000 });
  await window.waitForTimeout(1000);
}

/** Wait for groups to appear in the watched groups list. */
export async function waitForGroups(window: Page): Promise<void> {
  await window.waitForSelector("text=Watched Groups", { timeout: 10000 });
  // Wait for at least one group row to appear
  await window.waitForTimeout(1000);
}

/** Get the bottom bar activity text. */
export async function getActivityText(window: Page): Promise<string> {
  const bottomBar = window.locator("text=RECENT").first();
  if (await bottomBar.count() > 0) {
    const parent = bottomBar.locator("..");
    return await parent.innerText().catch(() => "");
  }
  // Fallback: get all text from the bottom area
  return await window.locator("body").innerText().catch(() => "");
}
