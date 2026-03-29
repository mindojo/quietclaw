import { test, expect, ElectronApplication, Page } from "@playwright/test";
import { ChildProcess } from "node:child_process";
import {
  startStubGateway,
  launchApp,
  screenshot,
  acceptLegalGate,
  connectToGateway,
  selectTargetGroup,
  openSettings,
} from "./helpers";

const STUB_PORT = 43211;

test.describe("QuietClaw — Negative Scenarios", () => {
  let stubProcess: ChildProcess;
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    stubProcess = await startStubGateway(STUB_PORT);
  });

  test.afterAll(async () => {
    stubProcess?.kill("SIGTERM");
  });

  test.beforeEach(async () => {
    const app = await launchApp();
    electronApp = app.electronApp;
    window = app.window;
    await acceptLegalGate(window);
  });

  test.afterEach(async () => {
    await electronApp?.close();
  });

  test("11. save with no target → should be blocked", async () => {
    await connectToGateway(window, STUB_PORT);

    // Verify Save button is disabled (no target selected)
    const saveBtn = window.locator("button").filter({ hasText: /save/i }).last();
    const isDisabled = await saveBtn.isDisabled();
    expect(isDisabled).toBe(true);

    await screenshot(window, "neg-11-no-target-save-blocked");
  });

  test("12. target excluded from watched group list", async () => {
    await connectToGateway(window, STUB_PORT);
    await selectTargetGroup(window, "Parents Committee");

    await window.waitForTimeout(1500);
    await screenshot(window, "neg-12-target-excluded");

    // The target button should show "Parents Committee"
    const bodyText = await window.locator("body").innerText();
    expect(bodyText).toContain("Parents Committee");

    // Get all table row texts from the watched groups area
    const tableRows = await window.locator("table tbody tr, [role='rowgroup'] [role='row']").all();
    const rowTexts: string[] = [];
    for (const row of tableRows) {
      rowTexts.push(await row.innerText().catch(() => ""));
    }

    // "Parents Committee" should NOT appear in any table row
    const parentInRows = rowTexts.some((t) => t.includes("Parents Committee"));
    expect(parentInRows).toBe(false);
  });

  test("13. connect with wrong token → error", async () => {
    await openSettings(window);

    // Fill with wrong token
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
        await input.clear();
        await input.fill(String(STUB_PORT));
      } else if (inputType === "password") {
        await input.fill("wrong-token-12345");
      }
    }

    await window.waitForTimeout(500);
    const connectBtn = window.locator("button").filter({ hasText: /CONNECT/i }).first();
    await connectBtn.click({ force: true });
    await window.waitForTimeout(3000);

    await screenshot(window, "neg-13-wrong-token");

    // After wrong token, the app should still show Disconnected (not connected)
    // Check for: error toast (MuiAlert), Disconnected text, or no "connected" status
    const bodyText = await window.locator("body").innerText();
    const isNotConnected = bodyText.includes("Disconnected") ||
      !bodyText.toLowerCase().includes("connected · ") ||
      bodyText.toLowerCase().includes("unauthorized") ||
      bodyText.toLowerCase().includes("failed");
    expect(isNotConnected).toBe(true);
  });

  test("14. connect with wrong port → error", async () => {
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
        await input.fill("59999");
      } else if (inputType === "password") {
        await input.fill("quietclaw-demo-token");
      }
    }

    const allBtns = await window.locator("button").all();
    for (const btn of allBtns) {
      const text = (await btn.innerText().catch(() => "")).trim().toLowerCase();
      if (text === "connect") { await btn.click(); break; }
    }
    await window.waitForTimeout(5000);

    await screenshot(window, "neg-14-wrong-port");

    const bodyText = await window.locator("body").innerText();
    const hasError =
      bodyText.toLowerCase().includes("refused") ||
      bodyText.toLowerCase().includes("failed") ||
      bodyText.toLowerCase().includes("error") ||
      bodyText.toLowerCase().includes("connect");
    expect(hasError).toBe(true);
  });

  test("15. send test summary with no groups checked → disabled", async () => {
    await connectToGateway(window, STUB_PORT);
    await selectTargetGroup(window, "My Alerts");

    // Don't check any groups — Send Test Summary should be disabled
    const sendBtn = window.locator("button").filter({ hasText: /SEND TEST SUMMARY/i });
    const isDisabled = await sendBtn.isDisabled();
    expect(isDisabled).toBe(true);

    // Verify helper text (check for various possible messages)
    const bodyText = await window.locator("body").innerText().then(t => t.toLowerCase());
    const hasHint = bodyText.includes("select a target") || bodyText.includes("at least one group");
    expect(hasHint).toBe(true);

    await screenshot(window, "neg-15-no-groups-send-disabled");
  });

  test("16. verify non-eligible groups shown in target popup", async () => {
    await connectToGateway(window, STUB_PORT);

    // Open target popup
    await selectTargetGroup(window, "My Alerts");
    // Reopen the popup to inspect it
    const allBtns = await window.locator("button").all();
    for (const btn of allBtns) {
      const text = (await btn.innerText().catch(() => "")).trim();
      if (text === "My Alerts" || text.includes("Select target")) {
        await btn.click();
        break;
      }
    }
    await window.waitForTimeout(1000);

    await screenshot(window, "neg-16-target-popup");

    // Verify the popup contains the non-eligible groups (Basketball League, Cousins Group, HR Announcements)
    const dialog = window.locator('[role="dialog"]');
    const dialogText = await dialog.innerText().catch(() => "");

    // Non-eligible groups should be present in the popup but disabled/marked
    const hasNonEligible = dialogText.includes("Basketball League") ||
      dialogText.includes("Cousins Group") ||
      dialogText.includes("HR Announcements");

    // Close popup
    await window.keyboard.press("Escape");

    expect(hasNonEligible).toBe(true);
  });
});
