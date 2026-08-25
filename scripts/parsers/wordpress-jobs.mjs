#!/usr/bin/env node
/**
 * Generic WordPress careers parser (WP REST API).
 *
 * Many company careers pages are WordPress sites that publish roles as a custom
 * post type exposed at `/wp-json/wp/v2/{postType}`. That endpoint returns the
 * whole board as JSON — no browser needed.
 *
 * Post types vary per site (`jobs`, `job_listing`, `career`, ...), so pass
 * `--post-type`. WordPress rarely exposes a location field, so location is
 * sniffed out of the rendered content against a city list; a blank location is
 * fine — portals.yml `location_filter` treats missing data as passing.
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage:
 *   node scripts/parsers/wordpress-jobs.mjs <careers_url> --post-type jobs \
 *        [--company Name] [--cities "Lahore,Karachi"]
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--'));

if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'missing careers_url', code: 'bad_args' }));
  process.exit(1);
}

const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const company = flag('--company');
const postType = flag('--post-type') || 'jobs';
const cities = (flag('--cities') || 'Lahore,Karachi,Islamabad,Rawalpindi,Pakistan,Remote')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

const PER_PAGE = 100;
const MAX_PAGES = 10;

const strip = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

let origin;
try {
  const parsed = new URL(careersUrl);
  if (parsed.protocol !== 'https:') throw new Error(`URL must use HTTPS: ${careersUrl}`);
  origin = parsed.origin;
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'bad_url' }));
  process.exit(1);
}

/** Pick the first city named in the JD body; '' when none match. */
function sniffLocation(text) {
  const hay = text.toLowerCase();
  for (const c of cities) {
    if (hay.includes(c.toLowerCase())) return c;
  }
  return '';
}

try {
  const jobs = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const api = `${origin}/wp-json/wp/v2/${encodeURIComponent(postType)}?per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(api, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (career-ops scan)' },
      redirect: 'follow',
    });

    // WP answers 400 once `page` runs past the last one — a normal end, not a failure.
    if (res.status === 400 && page > 1) break;
    if (!res.ok) {
      process.stdout.write(JSON.stringify({ error: `HTTP ${res.status}`, code: 'http_error' }));
      process.exit(1);
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const p of batch) {
      const title = strip(p?.title?.rendered);
      const url = p?.link;
      if (!title || !url || seen.has(url)) continue;
      seen.add(url);
      jobs.push({
        title,
        url,
        location: sniffLocation(`${title} ${strip(p?.content?.rendered).slice(0, 1500)}`),
        ...(company ? { company } : {}),
      });
    }

    if (batch.length < PER_PAGE) break;
  }

  process.stdout.write(JSON.stringify({ jobs }));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'fetch_error' }));
  process.exit(1);
}
