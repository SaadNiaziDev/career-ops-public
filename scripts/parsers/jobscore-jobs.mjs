#!/usr/bin/env node
/**
 * JobScore board parser (careers.jobscore.com/careers/{slug}).
 *
 * JobScore publishes a public Atom feed per board:
 *   GET https://careers.jobscore.com/jobs/{slug}/feed.atom
 * Each <entry> carries the title, an alternate link (job page), a location
 * category, and an id of the form tag:jobscore.com,YYYY-MM-DD:/{jobId} whose
 * date is the posting date (used as postedAt).
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/jobscore-jobs.mjs <careers_url|slug> [--company Name]
 */

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const company = flag('--company');

function fail(error, code) {
  process.stdout.write(JSON.stringify({ error, code }));
  process.exit(1);
}

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

function resolveSlug(value) {
  if (!value) return null;
  if (/^[a-z0-9_-]+$/i.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.hostname !== 'careers.jobscore.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // /careers/{slug}/... or /jobs/{slug}/feed.atom
    if (['careers', 'jobs'].includes(parts[0]) && parts[1]) return parts[1];
  } catch { /* fall through */ }
  return null;
}

/** Strip JobScore's tracking params so URLs dedup across runs. */
function cleanUrl(href) {
  const u = new URL(decode(href));
  u.searchParams.delete('ref');
  u.searchParams.delete('sid');
  return u.href;
}

async function main() {
  const slug = resolveSlug(input);
  if (!slug) fail(`not a JobScore board: ${input}`, 'bad_args');

  const feedUrl = `https://careers.jobscore.com/jobs/${encodeURIComponent(slug)}/feed.atom`;
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) fail(`HTTP ${res.status}`, 'http_error');
  const xml = await res.text();
  if (!xml.includes('<feed')) fail('unexpected response (no Atom <feed>)', 'parse_error');

  const jobs = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    const href = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1];
    if (!title || !href) continue;
    const location = decode(entry.match(/atom#location" term="([^"]*)"/)?.[1] || '');
    const postedAt = entry.match(/<id>tag:jobscore\.com,(\d{4}-\d{2}-\d{2}):/)?.[1]
      || entry.match(/<updated>(\d{4}-\d{2}-\d{2})/)?.[1];
    jobs.push({
      title,
      url: cleanUrl(href),
      ...(company ? { company } : {}),
      location,
      ...(postedAt ? { postedAt } : {}),
    });
  }
  process.stdout.write(JSON.stringify({ jobs }));
}

main().catch((err) => fail(err.message, 'fetch_error'));
