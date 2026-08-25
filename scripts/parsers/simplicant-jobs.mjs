#!/usr/bin/env node
/**
 * Simplicant (*.simplicant.com) board parser.
 *
 * Simplicant renders its board client-side and its listing backend requires
 * auth (`/jobs` redirects to hire.simplicant.com/login), so there is no public
 * JSON feed — this parser drives the repo's headless extractor instead.
 *
 * Two quirks it normalizes:
 *   - A `?country=XX` filter yields an EMPTY board, so the query is stripped
 *     and location filtering is left to portals.yml `location_filter`.
 *   - Rendered anchors read "Details {Title} {Location}" as one string. The
 *     job URL slug carries the title, so the title is matched off the slug and
 *     whatever trails it is the location.
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/simplicant-jobs.mjs <careers_url> [--company Name] [--max N]
 */

import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
const max = flag('--max') || '60';

const SIMPLICANT_HOST_RE = /^[a-z0-9][a-z0-9-]*\.simplicant\.com$/;
const SLUG_RE = /\/jobs\/\d+-([a-z0-9-]+)\/detail/i;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Split "Details {Title} {Location}" using the slug as the title oracle. */
function splitTitleLocation(raw, url) {
  const text = raw.replace(/^\s*Details\s+/i, '').trim();
  const slug = url.match(SLUG_RE)?.[1];
  if (!slug) return { title: text, location: '' };

  const target = norm(slug);
  const words = text.split(/\s+/);
  let acc = '';

  for (let i = 0; i < words.length; i++) {
    acc += norm(words[i]);
    if (acc === target) {
      return {
        title: words.slice(0, i + 1).join(' '),
        location: words.slice(i + 1).join(' ').trim(),
      };
    }
    // Overshot the slug — the title does not line up, keep the whole string.
    if (acc.length > target.length) break;
  }
  return { title: text, location: '' };
}

let boardUrl;
try {
  const parsed = new URL(careersUrl);
  if (parsed.protocol !== 'https:' || !SIMPLICANT_HOST_RE.test(parsed.hostname)) {
    throw new Error(`not a simplicant board: ${careersUrl}`);
  }
  // A country filter returns an empty board; scan location_filter handles geo.
  parsed.search = '';
  boardUrl = parsed.toString();
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'bad_url' }));
  process.exit(1);
}

try {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(REPO_ROOT, 'browser-extract.mjs'), boardUrl, '--mode', 'listing', '--max', max],
    { cwd: REPO_ROOT, maxBuffer: 10 * 1024 * 1024, timeout: 180000 },
  );

  const payload = JSON.parse(stdout);
  if (payload.error) {
    process.stdout.write(JSON.stringify({ error: payload.error, code: 'extract_error' }));
    process.exit(1);
  }

  const jobs = [];
  for (const j of payload.jobs || []) {
    if (!SLUG_RE.test(j.url || '')) continue; // drop board chrome ("Subscribe to Job Alerts")
    const { title, location } = splitTitleLocation(j.title || '', j.url);
    if (!title) continue;
    jobs.push({ title, url: j.url, location, ...(company ? { company } : {}) });
  }

  process.stdout.write(JSON.stringify({ jobs }));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err), code: 'extract_error' }));
  process.exit(1);
}
