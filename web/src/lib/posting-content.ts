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

function fullStackJobText(input: string): string {
  const posting = JSON.parse(input) as {
    jobTitle?: unknown;
    region?: unknown;
    linkedInWorkplaceType?: unknown;
    linkedInJobType?: unknown;
    sections?: Array<{ title?: unknown; body?: unknown }>;
  };
  const parts = [posting.jobTitle, posting.region, posting.linkedInWorkplaceType, posting.linkedInJobType]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  for (const section of posting.sections ?? []) {
    const title = typeof section.title === "string" ? section.title.trim() : "";
    const body = typeof section.body === "string" ? htmlText(section.body) : "";
    if (body) parts.push(title ? `${title}: ${body}` : body);
  }
  return parts.join("\n\n").slice(0, 40_000);
}

/** FullStack's public job pages load a multi-megabyte SPA; its public API is fast and includes the posting sections. */
async function fetchFullStackPosting(url: string): Promise<string | undefined> {
  const page = new URL(url);
  if (page.hostname !== "talent.fullstack.com") return undefined;
  const match = page.pathname.match(/^\/jobs\/([0-9a-f-]{36})\/?$/i);
  if (!match) return undefined;
  const response = await fetchPublicUrl(
    `https://api-v1.fullstack.com/api/job-postings/${match[1]}`,
    { headers: { "user-agent": "Career-Ops local job evaluator", accept: "application/json" } },
    { maxBytes: 1_500_000, timeoutMs: 12_000, maxRedirects: 2 },
  );
  if (!response.ok) return undefined;
  const data = await response.text();
  const posting = JSON.parse(data) as { isPublished?: unknown; statusName?: unknown };
  if (posting.isPublished === false || posting.statusName === "Unpublished") throw new Error("This posting is no longer available.");
  const content = fullStackJobText(data);
  if (content.length < 100) return undefined;
  return content;
}

/** Fetch static pages cheaply; render empty JS shells outside the AI worker. */
export async function fetchPostingContent(url: string): Promise<string> {
  let fetchError = "";
  try {
    const content = await fetchFullStackPosting(url);
    if (content) return content;
  } catch (error) {
    if (error instanceof Error && error.message === "This posting is no longer available.") throw error;
    /* Use the ordinary page and browser fallback if the provider API is unavailable. */
  }
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
