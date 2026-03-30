import { test, _electron as electron } from "@playwright/test";
import { resolvePackagedAppPath } from "./runtime";

test("diagnose blank page", async () => {
  const appPath = resolvePackagedAppPath();

  const electronApp = await electron.launch({
    executablePath: appPath,
    timeout: 30_000,
  });

  const window = await electronApp.firstWindow();

  // Collect console errors
  const errors: string[] = [];
  window.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  window.on("pageerror", (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await window.waitForLoadState("domcontentloaded");
  await window.waitForTimeout(5000);

  // Screenshot
  await window.screenshot({ path: "test-results/diagnose-blank.png" });

  // Dump all info
  const title = await window.title();
  const url = await window.url();
  const bodyHtml = await window.locator("body").innerHTML();
  const bodyText = await window.locator("body").innerText();

  console.log("=== TITLE:", title);
  console.log("=== URL:", url);
  console.log("=== BODY TEXT (first 500):", bodyText.slice(0, 500));
  console.log("=== BODY HTML (first 1000):", bodyHtml.slice(0, 1000));
  console.log("=== CONSOLE ERRORS:", JSON.stringify(errors, null, 2));

  // Check for React error boundaries
  const errorBoundary = await window.locator("[data-reactroot] .error, .MuiAlert-root").count();
  console.log("=== Error boundaries/alerts:", errorBoundary);

  await electronApp.close();
});
