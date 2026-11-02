// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Workable provider — hits the public markdown feed at /<slug>/jobs.md.
// Workable's documented JSON API requires an auth token; the markdown feed
// is the only no-auth public surface. Auto-detects from careers_url pattern
// `https://apply.workable.com/<slug>`. A tracked_companies entry can also
// set `provider: workable` explicitly to bypass detection. Large boards may
// define `workable_queries` and `workable_locations` to use the feed's public
// search parameters instead of receiving its unfiltered search notice.

const ALLOWED_WORKABLE_HOSTS = new Set(['apply.workable.com']);

function assertWorkableUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`workable: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`workable: URL must use HTTPS: ${url}`);
  if (!ALLOWED_WORKABLE_HOSTS.has(parsed.hostname)) {
    throw new Error(`workable: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_WORKABLE_HOSTS].join(', ')}`);
  }
  return url;
}

function resolveFeedUrl(entry) {
  const raw = typeof entry.careers_url === 'string' ? entry.careers_url : '';
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== 'apply.workable.com') return null;
  const slug = parsed.pathname.split('/').filter(Boolean)[0];
  if (!slug) return null;
  return `https://apply.workable.com/${slug}/jobs.md`;
}

function resolveFeedUrls(entry) {
  const base = resolveFeedUrl(entry);
  if (!base) return [];
  const queries = Array.isArray(entry.workable_queries)
    ? entry.workable_queries.filter((value) => typeof value === 'string' && value.trim()).slice(0, 12)
    : [];
  const locations = Array.isArray(entry.workable_locations)
    ? entry.workable_locations.filter((value) => typeof value === 'string' && value.trim()).slice(0, 12)
    : [];
  if (queries.length === 0 && locations.length === 0) return [base];

  const queryValues = queries.length > 0 ? queries : [''];
  return queryValues.map((query) => {
    const url = new URL(base);
    if (query) url.searchParams.set('query', query.trim());
    locations.forEach((country, index) => {
      url.searchParams.set(`location[${index}][country]`, country.trim());
    });
    return url.href;
  });
}

/** @type {Provider} */
export default {
  id: 'workable',

  detect(entry) {
    const feedUrl = resolveFeedUrl(entry);
    return feedUrl ? { url: feedUrl } : null;
  },

  async fetch(entry, ctx) {
    const feedUrls = resolveFeedUrls(entry);
    if (feedUrls.length === 0) throw new Error(`workable: cannot derive feed URL for ${entry.name}`);
    const jobsByUrl = new Map();
    let sawSearchNotice = false;
    for (const feedUrl of feedUrls) {
      assertWorkableUrl(feedUrl);
      // redirect:'error' prevents SSRF via server-side redirects; combined with
      // assertWorkableUrl above it guarantees the final hostname stays in the allowlist.
      const text = await ctx.fetchText(feedUrl, { redirect: 'error' });
      const parsed = parseWorkableMarkdown(text, entry.name);
      if (parsed.length === 0 && isSearchNotice(text)) sawSearchNotice = true;
      for (const job of parsed) jobsByUrl.set(job.url, job);
    }
    // Larger boards answer the unfiltered markdown feed with a "use the search
    // endpoint" notice and no table. Fall back to the public v3 jobs API, which
    // needs no auth and pages through the full board.
    if (jobsByUrl.size === 0 && sawSearchNotice) {
      const slug = new URL(feedUrls[0]).pathname.split('/').filter(Boolean)[0];
      for (const job of await fetchWorkableApi(slug, entry.name, ctx)) jobsByUrl.set(job.url, job);
    }
    return [...jobsByUrl.values()];
  },
};

const MAX_API_PAGES = 30;

function isSearchNotice(text) {
  return typeof text === 'string' && /Use the search endpoint/i.test(text);
}

/**
 * Page through `POST https://apply.workable.com/api/v3/accounts/<slug>/jobs`.
 * Exported for unit tests.
 */
export async function fetchWorkableApi(slug, companyName, ctx) {
  const apiUrl = assertWorkableUrl(`https://apply.workable.com/api/v3/accounts/${encodeURIComponent(slug)}/jobs`);
  const jobs = [];
  let token = null;
  for (let page = 0; page < MAX_API_PAGES; page++) {
    const body = { query: '', location: [], department: [], worktype: [], remote: [] };
    if (token) body.token = token;
    const data = await ctx.fetchJson(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
    });
    jobs.push(...parseWorkableApiResults(data?.results, slug, companyName));
    token = data?.nextPage;
    if (!token || !Array.isArray(data?.results) || data.results.length === 0) break;
  }
  return jobs;
}

/**
 * Map v3 API `results[]` to provider jobs. Internal-only postings are skipped.
 * Exported for unit tests.
 */
export function parseWorkableApiResults(results, slug, companyName) {
  if (!Array.isArray(results)) return [];
  const jobs = [];
  for (const r of results) {
    if (!r || typeof r.title !== 'string' || typeof r.shortcode !== 'string') continue;
    if (r.isInternal === true || (r.state && r.state !== 'published')) continue;
    const locs = Array.isArray(r.locations) && r.locations.length ? r.locations : [r.location].filter(Boolean);
    const location = locs
      .filter((l) => l && !l.hidden)
      .map((l) => [l.city, l.country].filter(Boolean).join(', '))
      .filter(Boolean);
    if (r.remote === true || r.workplace === 'remote') location.push('Remote');
    const postedAt = Date.parse(r.published);
    jobs.push({
      title: r.title.trim(),
      url: `https://apply.workable.com/${slug}/jobs/view/${r.shortcode}`,
      location: [...new Set(location)].join(' | '),
      company: companyName,
      ...(Number.isFinite(postedAt) ? { postedAt } : {}),
    });
  }
  return jobs;
}

/**
 * Parse Workable's public markdown feed. Exported as a named export for unit
 * tests. The feed exposes a table:
 *   | Title | Department | Location | Type | Salary | Posted | Details |
 * where `Details` holds a markdown link
 *   [View](https://apply.workable.com/<slug>/jobs/view/<id>.md)
 * URLs are validated against `https://apply.workable.com/` — off-domain or
 * non-HTTPS [View] links are skipped (not emitted).
 *
 * @param {string} text — markdown body
 * @param {string} companyName — value to write into job.company
 * @returns {Array<{title: string, url: string, company: string, location: string, postedAt?: number}>}
 */
export function parseWorkableMarkdown(text, companyName) {
  if (typeof text !== 'string') return [];
  const jobs = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|') || !line.includes('[View]')) continue;
    const cols = line.split('|').map(c => c.trim());
    // Cols: ['', title, dept, location, type, salary, posted, '[View](url.md)', '']
    if (cols.length < 8) continue;
    const title = cols[1];
    if (!title || title === 'Title') continue;
    const location = cols[3] || '';
    const urlMatch = line.match(/\[View\]\(([^)]+)\)/);
    let url = urlMatch ? urlMatch[1] : '';
    if (url.endsWith('.md')) url = url.slice(0, -3);
    if (!url) continue;  // skip rows with no resolvable URL (e.g., malformed [View] link)

    // Validate the extracted URL — must parse as https://apply.workable.com/...
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'apply.workable.com') continue;
      url = parsedUrl.href;
    } catch {
      continue;
    }

    const postedMatch = line.match(/\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*\[View\]/);
    const postedAt = postedMatch ? Date.parse(`${postedMatch[1]}T00:00:00Z`) : NaN;
    jobs.push({
      title,
      url,
      location,
      company: companyName,
      ...(Number.isFinite(postedAt) ? { postedAt } : {}),
    });
  }
  return jobs;
}
