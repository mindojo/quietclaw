import { _electron as electron, ElectronApplication, Page } from "@playwright/test";
import { ChildProcess } from "node:child_process";

import {
  clearConfigJsonFiles,
  readDaemonPort,
  resolvePackagedAppPath,
  seedOnboardedConfig,
  spawnTsxScript,
  waitForListening,
} from "./runtime";

const APP_PATH = resolvePackagedAppPath();

export async function startLiveDaemon(port: number): Promise<ChildProcess> {
  const proc = spawnTsxScript("services/live-daemon/src/index.ts", {
    DAEMON_PORT: String(port),
  });

  await waitForListening(proc, "Live daemon");
  return proc;
}

export const startStubGateway = startLiveDaemon;

export async function launchApp(opts?: {
  env?: Record<string, string>;
  keepConfig?: boolean;
  seedOnboarded?: boolean;
}): Promise<{ electronApp: ElectronApplication; window: Page }> {
  if (!opts?.keepConfig) {
    clearConfigJsonFiles();
  }
  if (opts?.seedOnboarded) {
    seedOnboardedConfig();
  }

  const electronApp = await electron.launch({
    executablePath: APP_PATH,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      QUIETCLAW_FAKE_OUTBOUND: "1",
      ...opts?.env,
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await window.waitForTimeout(3000);

  return { electronApp, window };
}

export async function screenshot(window: Page, name: string): Promise<void> {
  await window.waitForTimeout(300);
  await window.screenshot({ path: `test-results/${name}.png` });
}

export async function acceptLegalGate(window: Page): Promise<void> {
  await closeAnyDialog(window);

  const legalTitle = window.locator("text=QuietClaw Desktop Monitor").first();
  const continueBtn = window.locator("button").filter({ hasText: /continue/i });

  const isLegalVisible = await legalTitle.isVisible({ timeout: 3000 }).catch(() => false);
  const hasContinue = await continueBtn.isVisible({ timeout: 1000 }).catch(() => false);

  if (!isLegalVisible || !hasContinue) {
    await closeAnyDialog(window);
    return;
  }

  const acceptLabel = window.locator("text=I understand and accept").first();
  await acceptLabel.click();

  await window.waitForTimeout(400);
  await continueBtn.click();
  await window.waitForTimeout(2000);
}

export async function closeAnyDialog(window: Page): Promise<void> {
  const dialog = window.locator('[role="dialog"], [role="presentation"]').first();
  if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await window.keyboard.press("Escape");
    await window.waitForTimeout(500);
  }
}

export async function ensureDashboard(window: Page): Promise<void> {
  const backButton = window.locator("button").filter({ hasText: /back to dashboard/i }).first();
  if (await backButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await backButton.click();
    await window.waitForTimeout(1000);
  }
}

export async function openSettings(window: Page): Promise<void> {
  await ensureDashboard(window);
  const btn = window.locator('[aria-label="Open settings"]').first();
  try {
    await btn.click({ timeout: 5000 });
  } catch {
    await window.keyboard.press("Escape");
    await window.waitForTimeout(500);
    await btn.click({ timeout: 5000 });
  }
  await window.waitForTimeout(1500);
}

export async function connectToGateway(
  window: Page,
  port: number,
  token = "quietclaw-demo-token",
): Promise<void> {
  void port;
  void token;
  await ensureDashboard(window);
}

export function startSimulatorForCurrentDaemon(): ChildProcess {
  return spawnTsxScript("services/simulator/src/index.ts", {
    DAEMON_URL: `http://127.0.0.1:${readDaemonPort()}`,
  });
}

export async function waitForGroups(window: Page): Promise<void> {
  await ensureDashboard(window);
  await window.waitForSelector("text=Watched groups", { timeout: 10000 });
  await window.waitForFunction(() => document.body.innerText.includes("messages"), undefined, {
    timeout: 20000,
  });
  await window.waitForTimeout(1000);
}

export async function waitForGroupByName(window: Page, groupName: string): Promise<void> {
  await window.waitForSelector(`text=${groupName}`, { timeout: 20000 });
}

export async function toggleGroup(
  window: Page,
  kind: "summary" | "urgent",
  groupName: string,
): Promise<void> {
  const label =
    kind === "summary"
      ? `Toggle summary for ${groupName}`
      : `Toggle urgent for ${groupName}`;
  await window.locator(`button[aria-label="${label}"]`).click({ timeout: 10000 });
  await window.waitForTimeout(500);
}

export async function clickSendTestSummary(window: Page): Promise<void> {
  await window.getByRole("button", { name: /send test summary/i }).click();
  await window.waitForTimeout(1500);
}

export async function clickSendTestMessage(window: Page): Promise<void> {
  await window.getByRole("button", { name: /send test message/i }).click();
  await window.waitForTimeout(1500);
}

export async function connectToGatewayLegacy(
  window: Page,
  port: number,
  token = "quietclaw-demo-token",
): Promise<void> {
  await openSettings(window);

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

  const buttons = await window.locator("button").all();
  for (const btn of buttons) {
    const text = (await btn.innerText().catch(() => "")).trim();
    if (text === "CONNECT" || text === "Connect") {
      await btn.click();
      break;
    }
  }

  await window.waitForTimeout(4000);
  await window.keyboard.press("Escape");
  await window.waitForTimeout(1000);
}

export async function selectTargetGroup(window: Page, groupName: string): Promise<void> {
  void groupName;
  await ensureDashboard(window);
}

export async function selectTargetGroupLegacy(window: Page, groupName: string): Promise<void> {
  const allBtns = await window.locator("button").all();
  for (const btn of allBtns) {
    const text = (await btn.innerText().catch(() => "")).trim();
    if (text.includes("Select target group") || text === groupName) {
      await btn.click();
      break;
    }
  }

  await window.waitForTimeout(1000);

  const dialog = window.locator('[role="dialog"]');
  const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
  if (!dialogVisible) {
    for (const btn of allBtns) {
      const text = (await btn.innerText().catch(() => "")).trim();
      if (text.includes("Select target group") || text.includes("target")) {
        await btn.click();
        break;
      }
    }
    await window.waitForTimeout(1000);
  }

  const groupItem = dialog.locator(`text=${groupName}`).first();
  await groupItem.click({ timeout: 10000 });
  await window.waitForTimeout(1000);
}

export async function getActivityText(window: Page): Promise<string> {
  const bottomBar = window.locator("text=RECENT").first();
  if (await bottomBar.count() > 0) {
    const parent = bottomBar.locator("..");
    return await parent.innerText().catch(() => "");
  }

  return await window.locator("body").innerText().catch(() => "");
}
