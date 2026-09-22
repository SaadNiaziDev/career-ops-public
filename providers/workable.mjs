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
    for (const feedUrl of feedUrls) {
      assertWorkableUrl(feedUrl);
      // redirect:'error' prevents SSRF via server-side redirects; combined with
      // assertWorkableUrl above it guarantees the final hostname stays in the allowlist.
      const text = await ctx.fetchText(feedUrl, { redirect: 'error' });
      for (const job of parseWorkableMarkdown(text, entry.name)) jobsByUrl.set(job.url, job);
    }
    return [...jobsByUrl.values()];
  },
};

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
