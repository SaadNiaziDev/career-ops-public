import { chromium } from "playwright-core";
import { fetchPublicUrl, installPublicUrlPolicy, launchPublicBrowser } from "@/lib/public-url-policy";

function structuredJobText(input: string): string {
  const blocks = [...input.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const records: unknown[] = [];
  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1]);
      records.push(...(Array.isArray(value) ? value : [value]));
    } catch { /* Ignore unrelated or malformed structured data. */ }
  }
  const text: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (item["@type"] === "JobPosting" || (Array.isArray(item["@type"]) && item["@type"].includes("JobPosting"))) {
      for (const key of ["title", "description", "employmentType", "datePosted", "validThrough", "hiringOrganization", "jobLocation", "baseSalary"]) {
        const field = item[key];
        if (typeof field === "string") text.push(`${key}: ${field}`);
        else if (field && typeof field === "object") text.push(`${key}: ${JSON.stringify(field)}`);
      }
    }
    visit(item["@graph"]);
    visit(item["mainEntity"]);
  };
  records.forEach(visit);
  return text.join("\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 40_000);
}

function htmlText(input: string): string {
  const structured = structuredJobText(input);
  if (structured.length >= 100) return structured;
  return input.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ").trim().slice(0, 40_000);
}

/** Fetch static pages cheaply; render empty JS shells outside the AI worker. */
export async function fetchPostingContent(url: string): Promise<string> {
  let fetchError = "";
  try {
    const response = await fetchPublicUrl(url, {headers: {"user-agent": "Career-Ops local job evaluator"}}, {maxBytes: 1_500_000, timeoutMs: 12_000, maxRedirects: 4});
    if ([404, 410].includes(response.status)) throw new Error(`Posting fetch returned HTTP ${response.status}.`);
    if (response.ok) {
      const content = htmlText(await response.text());
      if (content.length >= 100) return content;
    }
    fetchError = response.ok ? `The website returned HTTP ${response.status}, but its initial HTML contains no job description.` : `Posting fetch returned HTTP ${response.status}.`;
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Posting fetch failed.";
    if (/HTTP (404|410)/.test(fetchError)) throw error;
  }
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await launchPublicBrowser(chromium, {headless: true});
    const context = await browser!.newContext();
    await installPublicUrlPolicy(context);
    const page = await context.newPage();
    const response = await page.goto(url, {waitUntil: "commit", timeout: 15_000});
    if ([404, 410].includes(response?.status() ?? 0)) throw new Error("This posting is no longer available.");
    await page.waitForFunction(() => (document.querySelector("main, article, [role=main]") ?? document.body)?.textContent && (document.body.innerText ?? "").trim().length >= 100, undefined, {timeout: 90_000});
    const content = await page.evaluate(() => (document.querySelector("main, article, [role=main]") as HTMLElement | null ?? document.body).innerText.trim().slice(0, 40_000));
    if (content.length < 100 || /checking your browser|verify you are human|just a moment/i.test(content)) throw new Error("Posting content is unavailable.");
    return content;
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : "Unknown browser error.";
    throw new Error(`${fetchError} Browser extraction failed: ${detail}. Retry the URL or paste the job description to continue.`);
  } finally { await browser?.close().catch(() => undefined); }
}
