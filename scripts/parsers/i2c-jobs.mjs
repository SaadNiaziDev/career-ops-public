#!/usr/bin/env node
/**
 * i2c (careers.i2cinc.com) board parser.
 *
 * i2c runs a bespoke PHP recruitment portal. The listing page ships no jobs in
 * its HTML — they arrive from `POST /ajax.php` with `f=getJobsPager`, which
 * answers with a JSON envelope whose `html` field holds the rendered rows.
 * Parsing that fragment gets the whole board in one request, no browser.
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/i2c-jobs.mjs <careers_url> [--company Name]
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--'));

if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'missing careers_url', code: 'bad_args' }));
  process.exit(1);
}

const companyIdx = args.indexOf('--company');
const company = companyIdx !== -1 ? args[companyIdx + 1] : undefined;

const ROW_SPLIT = /<div\s+class="job-tile">/i;
const HREF = /<a\s+href="([^"]*showjob\/[^"]+)"/i;
const TITLE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i;
const LOCATION = /joblisting-location[^>]*>([\s\S]*?)<\/span>/i;

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

let origin;
try {
  const parsed = new URL(careersUrl);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'careers.i2cinc.com') {
    throw new Error(`not an i2c careers URL: ${careersUrl}`);
  }
  origin = parsed.origin;
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'bad_url' }));
  process.exit(1);
}

try {
  const res = await fetch(`${origin}/ajax.php`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'Mozilla/5.0 (career-ops scan)',
    },
    body: 'f=getJobsPager&s=',
    redirect: 'error',
  });

  if (!res.ok) {
    process.stdout.write(JSON.stringify({ error: `HTTP ${res.status}`, code: 'http_error' }));
    process.exit(1);
  }

  const body = await res.json();
  const html = typeof body?.html === 'string' ? body.html : '';
  const seen = new Set();
  const jobs = [];

  for (const chunk of html.split(ROW_SPLIT).slice(1)) {
    const href = chunk.match(HREF);
    const title = chunk.match(TITLE);
    if (!href || !title) continue;

    // Rows use portal-relative hrefs like "index.php/showjob/slug".
    const url = new URL(href[1].replace(/^\.?\//, ''), `${origin}/careers/`).toString();
    if (seen.has(url)) continue;
    seen.add(url);

    const cleanTitle = decode(title[1]);
    if (!cleanTitle) continue;

    const loc = chunk.match(LOCATION);
    jobs.push({
      title: cleanTitle,
      url,
      location: loc ? decode(loc[1]) : '',
      ...(company ? { company } : {}),
    });
  }

  process.stdout.write(JSON.stringify({ jobs }));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'fetch_error' }));
  process.exit(1);
}
