import { spawn } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

/**
 * Post-filter for AI search candidates: reuse the core's zero-token ATS API
 * check, then Playwright for non-ATS / inconclusive URLs — same ladder as
 * check-liveness.mjs. Expired postings are dropped by the Explore UI before
 * the user sees them; active ones get verification: "live".
 */
export type OfferLiveness = {
  url: string;
  result: "active" | "expired" | "uncertain";
  reason: string;
  via: "api" | "browser" | "none";
};

export function checkOffersLiveness(urls: string[]): Promise<OfferLiveness[]> {
  const clean = [...new Set(urls.map((u) => String(u || "").trim()).filter((u) => /^https?:\/\//i.test(u)))];
  if (clean.length === 0) return Promise.resolve([]);

  if (!fs.existsSync(rootScript("liveness-api"))) {
    return Promise.resolve(
      clean.map((url) => ({
        url,
        result: "uncertain" as const,
        reason: "liveness-api.mjs not available in this checkout",
        via: "none" as const,
      })),
    );
  }

  const apiUrl = pathToFileURL(rootScript("liveness-api")).href;
  const browserUrl = pathToFileURL(rootScript("liveness-browser")).href;
  const hasBrowser = fs.existsSync(rootScript("liveness-browser"));

  const code = `
import { checkLivenessViaApi } from ${JSON.stringify(apiUrl)};
${hasBrowser ? `import { checkUrlLiveness, newLivenessPage } from ${JSON.stringify(browserUrl)};` : ""}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", async () => {
  const urls = JSON.parse(input);
  const results = [];
  let browser = null;
  let page = null;
  async function ensureBrowser() {
    if (browser || !${hasBrowser}) return;
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ headless: true });
      page = await newLivenessPage(browser);
    } catch (e) {
      browser = null;
      page = null;
      return String((e && e.message) || e);
    }
    return null;
  }
  try {
    for (const url of urls) {
      try {
        const api = await checkLivenessViaApi(url);
        if (api) {
          results.push({ url, result: api.result, reason: api.reason, via: "api" });
          continue;
        }
        const launchErr = await ensureBrowser();
        if (!page) {
          results.push({
            url,
            result: "uncertain",
            reason: launchErr || "not an ATS posting — browser check unavailable",
            via: "none",
          });
          continue;
        }
        const r = await checkUrlLiveness(page, url);
        results.push({ url, result: r.result, reason: r.reason, via: "browser" });
      } catch (e) {
        results.push({
          url,
          result: "uncertain",
          reason: String((e && e.message) || e),
          via: "none",
        });
      }
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
  process.stdout.write(JSON.stringify(results));
});
`;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
      cwd: careerOpsRoot(),
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) =>
      resolve(
        clean.map((url) => ({
          url,
          result: "uncertain" as const,
          reason: e instanceof Error ? e.message : "spawn failed",
          via: "none" as const,
        })),
      ),
    );
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out.trim() || "[]") as OfferLiveness[];
        if (!Array.isArray(parsed)) throw new Error("bad shape");
        const byUrl = new Map(parsed.map((r) => [r.url, r]));
        resolve(
          clean.map(
            (url) =>
              byUrl.get(url) ?? {
                url,
                result: "uncertain" as const,
                reason: err.trim().slice(0, 200) || "no liveness result",
                via: "none" as const,
              },
          ),
        );
      } catch {
        resolve(
          clean.map((url) => ({
            url,
            result: "uncertain" as const,
            reason: err.trim().slice(0, 200) || "liveness checker returned no result",
            via: "none" as const,
          })),
        );
      }
    });
    child.stdin.write(JSON.stringify(clean));
    child.stdin.end();
  });
}
