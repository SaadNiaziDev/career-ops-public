#!/usr/bin/env node
/**
 * Convo recruitment-portal parser.
 *
 * convo.com/careers renders jobs client-side from its own recruitment gateway
 * (window.CONVO_RECRUITMENT_JOBS.apiUrl). The gateway's public list endpoint
 *   GET {apiUrl}/api/jobs → [{ title, slug, location, status, createdAt, … }]
 * returns open and closed postings; only status === "open" is emitted. Job
 * pages live at {portalUrl}/apply/{slug}. Both URLs are discovered from the
 * careers page so a gateway redeploy does not break the parser.
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout, with postedAt (createdAt).
 *
 * Usage: node scripts/parsers/convo-portal-jobs.mjs <careers_url> [--company Name]
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--')) || 'https://www.convo.com/careers/';
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const company = flag('--company') || 'Convo';

function fail(error, code) {
  process.stdout.write(JSON.stringify({ error, code }));
  process.exit(1);
}

const AZURE_RE = /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+\.azurecontainerapps\.io$/i;

function trustedOrigin(raw) {
  const u = new URL(raw.replace(/\\\//g, '/'));
  if (u.protocol !== 'https:' || !AZURE_RE.test(u.hostname)) throw new Error(`untrusted portal host: ${u.hostname}`);
  return u.origin;
}

async function main() {
  const page = await fetch(careersUrl, { signal: AbortSignal.timeout(30000) });
  if (!page.ok) fail(`careers page HTTP ${page.status}`, 'http_error');
  const html = await page.text();
  const apiRaw = html.match(/data-api-url="([^"]+)"/)?.[1] || html.match(/"apiUrl":"([^"]+)"/)?.[1];
  const portalRaw = html.match(/data-portal-url="([^"]+)"/)?.[1] || html.match(/"portalUrl":"([^"]+)"/)?.[1];
  if (!apiRaw || !portalRaw) fail('portal config not found on careers page', 'parse_error');

  const api = trustedOrigin(apiRaw);
  const portal = trustedOrigin(portalRaw);
  const res = await fetch(`${api}/api/jobs`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) fail(`jobs API HTTP ${res.status}`, 'http_error');
  const list = await res.json();
  if (!Array.isArray(list)) fail('jobs API did not return an array', 'parse_error');

  const jobs = list
    .filter((j) => j && j.status === 'open' && typeof j.title === 'string' && typeof j.slug === 'string')
    .map((j) => ({
      title: j.title.trim(),
      url: `${portal}/apply/${encodeURIComponent(j.slug)}`,
      company,
      location: [j.workLocationType, j.location].filter(Boolean).join(' · '),
      ...(j.createdAt ? { postedAt: String(j.createdAt).slice(0, 10) } : {}),
    }));
  process.stdout.write(JSON.stringify({ jobs }));
}

main().catch((err) => fail(err.message, 'fetch_error'));
