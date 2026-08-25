#!/usr/bin/env node
/**
 * Hirestream (*.hirestream.io) board parser.
 *
 * The board itself is a JS SPA, but Hirestream exposes its published roles as
 * public paginated JSON at `/api/v1/jobs/published-jobs/` — no auth, no
 * headless browser. (The tenant-wide `/api/v1/jobs/` endpoint is 401; only
 * `published-jobs/` is public.)
 *
 * Public job pages live at `/careers/job/view-job/{uuid}/`.
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/hirestream-jobs.mjs <careers_url> [--company Name]
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--'));

if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'missing careers_url', code: 'bad_args' }));
  process.exit(1);
}

const companyIdx = args.indexOf('--company');
const company = companyIdx !== -1 ? args[companyIdx + 1] : undefined;

const HIRESTREAM_HOST_RE = /^[a-z0-9][a-z0-9-]*\.hirestream\.io$/;
const PAGE_SIZE = 50;
const MAX_PAGES = 20; // guard against a pagination loop

let origin;
try {
  const parsed = new URL(careersUrl);
  if (parsed.protocol !== 'https:' || !HIRESTREAM_HOST_RE.test(parsed.hostname)) {
    throw new Error(`not a hirestream board: ${careersUrl}`);
  }
  origin = parsed.origin;
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'bad_url' }));
  process.exit(1);
}

try {
  const jobs = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const api = `${origin}/api/v1/jobs/published-jobs/?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(api, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (career-ops scan)' },
      redirect: 'error',
    });

    if (!res.ok) {
      process.stdout.write(JSON.stringify({ error: `HTTP ${res.status}`, code: 'http_error' }));
      process.exit(1);
    }

    const body = await res.json();
    const results = Array.isArray(body?.results) ? body.results : [];

    for (const r of results) {
      if (!r?.title || !r?.uuid) continue;
      jobs.push({
        title: String(r.title).replace(/\s+/g, ' ').trim(),
        url: `${origin}/careers/job/view-job/${r.uuid}/`,
        location: [r.location, r.is_remote ? 'Remote' : ''].filter(Boolean).join(', '),
        ...(company ? { company } : {}),
      });
    }

    if (!body?.next || results.length === 0) break;
    offset += PAGE_SIZE;
  }

  process.stdout.write(JSON.stringify({ jobs }));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'fetch_error' }));
  process.exit(1);
}
