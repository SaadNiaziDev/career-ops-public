import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { chromium } from "playwright-core";

// The app's optional web fonts may be unreachable in an offline checkout.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";

const widths = [320, 390, 768, 1280];
const roles = Array.from({ length: 16 }, (_, index) => `Frontend role ${index + 1}`);
const exclusions = Array.from({ length: 12 }, (_, index) => `Excluded role ${index + 1}`);
const snapshots = await mkdtemp(join(tmpdir(), "career-ops-mobile-layout-"));

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/start-local.mjs", "start"], {
  cwd: import.meta.dirname,
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
  detached: true,
});

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${origin}/config`);
      if (response.ok) { ready = true; break; }
    } catch { /* server still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "local web server did not become ready");
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }

  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.setItem("career-ops:tour-completed", JSON.stringify(["onboarding", "dashboard", "explore", "config"])));
    await page.route("**/api/version", (route) => route.fulfill({ json: { version: "0.4.0", channel: "beta", sha: "test" } }));
    await page.goto(`${origin}/config`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Report a bug" }).waitFor();
    if (width < 1024) {
      const tabs = page.locator('[aria-label="Config sections"]:visible button');
      assert.equal(await tabs.count(), 4, `${width}px must expose every Config section`);
      for (const tab of await tabs.all()) {
        const box = await tab.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `${width}px Config tab is clipped`);
      }
    }
    const reportControl = page.getByRole("button", { name: "Report a bug" });
    assert.notEqual(await reportControl.locator("..").evaluate((node) => getComputedStyle(node).position), "fixed", `${width}px report control must not cover content`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const pill = await reportControl.locator("..").boundingBox();
    assert.ok(pill && pill.x >= 0 && pill.x + pill.width <= width && pill.y + pill.height <= 844, `${width}px report control leaves viewport`);
    const configShot = await page.screenshot({ path: join(snapshots, `config-${width}.png`), fullPage: true });
    assert.ok(configShot.length > 10_000, `${width}px Config screenshot is empty`);

    const query = new URLSearchParams({ q: roles.join(","), not: exclusions.join(",") });
    await page.goto(`${origin}/explore?${query}`, { waitUntil: "domcontentloaded" });
    const showRoles = page.getByRole("button", { name: `Show all ${roles.length} roles` });
    await showRoles.waitFor();
    assert.equal(await page.locator('[aria-label^="Remove Frontend role"]').count(), 3, `${width}px role chips should start collapsed`);
    const collapsedShot = await page.screenshot({ path: join(snapshots, `explore-collapsed-${width}.png`), fullPage: true });
    assert.ok(collapsedShot.length > 10_000, `${width}px collapsed Explore screenshot is empty`);
    await showRoles.click();
    await page.getByRole("searchbox", { name: "Search roles" }).fill("role 12");
    assert.equal(await page.locator('[aria-label^="Remove Frontend role"]').count(), 1, `${width}px search should filter editable chips`);
    const expandedShot = await page.screenshot({ path: join(snapshots, `explore-search-${width}.png`), fullPage: true });
    assert.ok(expandedShot.length > 10_000, `${width}px expanded Explore screenshot is empty`);
    await page.close();
  }
  process.stdout.write(`Mobile screenshots and layout assertions passed: ${snapshots}\n`);
} finally {
  await browser?.close();
  if (server.pid) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { /* already exited */ }
  }
}
