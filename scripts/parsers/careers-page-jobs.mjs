#!/usr/bin/env node
/**
 * careers-page.com board parser.
 *
 * Boards are server-rendered, so a plain fetch is enough. Each role is an
 * `<li class="media">` row holding a `/{tenant}/job/{id}` link, an `<h5>`
 * title, and a fa-map-marker span with the location.
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/careers-page-jobs.mjs <careers_url> [--company Name]
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--'));

if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'missing careers_url', code: 'bad_args' }));
  process.exit(1);
}

const companyIdx = args.indexOf('--company');
const company = companyIdx !== -1 ? args[companyIdx + 1] : undefined;

const JOB_HREF = /href="(\/[^"]*\/job\/[A-Za-z0-9]+)"/i;
const TITLE = /<h5\b[^>]*>([\s\S]*?)<\/h5>/i;
const LOCATION = /fa-map-marker-alt[^>]*><\/i>([\s\S]*?)<\/span>/i;

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
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'careers-page.com') {
    throw new Error(`not a careers-page board: ${careersUrl}`);
  }
  origin = parsed.origin;
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'bad_url' }));
  process.exit(1);
}

try {
  const res = await fetch(careersUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 (career-ops scan)' },
    redirect: 'follow',
  });

  if (!res.ok) {
    process.stdout.write(JSON.stringify({ error: `HTTP ${res.status}`, code: 'http_error' }));
    process.exit(1);
  }

  const html = await res.text();
  const seen = new Set();
  const jobs = [];

  // Split into row chunks first so no regex ever spans two roles.
  for (const chunk of html.split(/<li\s+class="media">/i).slice(1)) {
    const href = chunk.match(JOB_HREF);
    const title = chunk.match(TITLE);
    if (!href || !title) continue;

    const url = `${origin}${href[1]}`;
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
