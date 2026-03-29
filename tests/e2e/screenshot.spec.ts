import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";

const appDir = path.resolve(__dirname, "../../apps/desktop-monitor");
const appPath = path.resolve(
  appDir,
  "out/QuietClaw-darwin-arm64/QuietClaw.app/Contents/MacOS/QuietClaw"
);

test.describe("QuietClaw Desktop — Visual Verification", () => {
  test("app launches and renders the legal gate", async () => {
    const electronApp = await electron.launch({
      executablePath: appPath,
      timeout: 30_000,
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    // Wait for React to render
    await window.waitForTimeout(3000);

    // Take screenshot
    await window.screenshot({
      path: "test-results/quietclaw-launch.png",
    });

    // Verify we have content (not blank)
    const title = await window.title();
    console.log("Window title:", title);
    expect(title).toBe("QuietClaw");

    // Check that the body has visible content
    const bodyText = await window.locator("body").innerText();
    console.log("Body text preview:", bodyText.slice(0, 200));
    expect(bodyText.length).toBeGreaterThan(0);

    // Try to find the legal gate or loading state
    const hasLegalGate = await window.locator("text=I understand and accept").count();
    const hasLoading = await window.locator("text=Loading").count();
    const hasQuietClaw = await window.locator("text=QuietClaw").count();
    console.log(
      `Legal gate: ${hasLegalGate}, Loading: ${hasLoading}, QuietClaw text: ${hasQuietClaw}`
    );

    // At least one of these should be present
    expect(hasLegalGate + hasLoading + hasQuietClaw).toBeGreaterThan(0);

    await electronApp.close();
  });
});
