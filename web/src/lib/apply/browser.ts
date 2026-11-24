import { applicationBrowserUrl } from "./browser-settings";

// Headed Chromium for filling application forms: one shared browser, resilient navigation.
import { chromium, type Browser, type BrowserContext, type Page, type Frame, type Response } from "playwright-core";

/** The frame with the most interactive controls — where the agentic interpreter
 *  should look when deterministic extraction found nothing usable. */
export async function richestControlFrame(page: Page): Promise<Frame> {
  let best = page.mainFrame();
  let bestN = -1;
  for (const fr of page.frames()) {
    const n = await fr.evaluate(() => document.querySelectorAll('input, textarea, select, [role="combobox"], [contenteditable="true"]').length).catch(() => 0);
    if (n > bestN) {
      bestN = n;
      best = fr;
    }
  }
  return best;
}

/** Escape a value for use inside a double-quoted CSS attribute selector.
 *  Backslash FIRST, then quote — escaping only the quote would let a trailing
 *  backslash neutralize the closing quote (CodeQL js/incomplete-sanitization). */
export function cssAttr(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Navigate resiliently: a transient nav error / slow ATS shouldn't fail the
 *  whole apply. Up to 3 attempts with backoff; returns the navigation Response
 *  (status/headers feed the cheap status-block check). */
export async function gotoResilient(page: Page, url: string): Promise<Response | null> {
  const fullStackJobPage = new URL(url).hostname === "talent.fullstack.com" && /^\/jobs\/[0-9a-f-]{36}\/?$/i.test(new URL(url).pathname);
  let lastErr: unknown;
  for (let attempt = 0; attempt < (fullStackJobPage ? 1 : 3); attempt++) {
    try {
      const resp = await page.goto(url, {
        waitUntil: fullStackJobPage ? "commit" : "domcontentloaded",
        timeout: fullStackJobPage ? 12_000 : 30_000,
      });
      if (!fullStackJobPage) await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
      return resp;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(800 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("could not open the page");
}

export const IN_CODEX_SANDBOX = process.env.CODEX_SANDBOX === "seatbelt";

export async function headedBrowser(): Promise<Browser> {
  const cdpUrl = applicationBrowserUrl();
  const b = globalThis.__coHeadedBrowser;
  if (b && b.isConnected()) {
    // Refresh the cached browser after a connection change or a legacy hot reload.
    // Never close a Chrome instance owned by the user.
    if (globalThis.__coHeadedBrowserOwned === undefined || globalThis.__coHeadedBrowserUrl !== cdpUrl) {
      if (globalThis.__coHeadedBrowserOwned !== false) await b.close().catch(() => {});
      globalThis.__coHeadedBrowser = undefined;
    } else {
      return b;
    }
  }
  if (!cdpUrl && IN_CODEX_SANDBOX && process.platform === "darwin") {
    throw new Error("Visible Chrome cannot start inside the Codex macOS sandbox. Run the web app outside Codex, or use Codex with -s danger-full-access for this session.");
  }
  // When configured, attach to the user's already-running Chrome. This keeps
  // its cookies and authenticated ATS sessions instead of creating an anonymous
  // Playwright context.
  if (cdpUrl) {
    try {
      const connected = await chromium.connectOverCDP(cdpUrl, { timeout: 8000 });
      globalThis.__coHeadedBrowser = connected;
      globalThis.__coHeadedBrowserOwned = false;
      globalThis.__coHeadedBrowserUrl = cdpUrl;
      return connected;
    } catch {
      throw new Error("Could not connect to authenticated Chrome. Check the browser connection in Settings and retry.");
    }
  }
  // Apply uses installed Chrome directly. The public-URL proxy is appropriate
  // for headless fetch/liveness checks but breaks some ATS pages and can surface
  // as ERR_TIMED_OUT in the visible browser. URL validation and page-level
  // request filtering still run below.
  try {
    const nb = await chromium.launch({
      channel: "chrome",
      headless: false,
      args: ["--window-position=-3200,-3200", "--window-size=1280,940"], // off-screen during fill; moved on-screen at handoff
    });
    globalThis.__coHeadedBrowser = nb;
    globalThis.__coHeadedBrowserOwned = true;
    globalThis.__coHeadedBrowserUrl = cdpUrl;
    return nb;
  } catch {
    throw new Error("The apply feature needs installed Google Chrome. Open Chrome once, then retry; headless Chrome for Testing is not used for visible application sessions.");
  }
}

export async function sessionContext(browser: Browser): Promise<{ context: BrowserContext; closeContext: boolean }> {
  // A CDP connection exposes the user's existing default context. Reuse it so
  // its authenticated cookies are available to the new tab. A browser launched
  // by us has no contexts yet, so use an isolated context for cleanup safety.
  if (globalThis.__coHeadedBrowserOwned === false) {
    const existing = browser.contexts()[0];
    if (existing) return { context: existing, closeContext: false };
  }
  return { context: await browser.newContext({ viewport: { width: 1280, height: 900 } }), closeContext: true };
}

/** Bounded scroll pass to trigger lazy/virtualized forms that only render their
 *  fields once scrolled into view, then return to the top. */
export async function nudgeScroll(page: Page): Promise<void> {
  for (let i = 1; i <= 3; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * 1200).catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}
