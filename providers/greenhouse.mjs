// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */
import { decodeEntities } from './_html-entities.mjs';

// Greenhouse provider — hits the public boards-api JSON endpoint.
// Handles both explicit `api:` URLs and auto-detection from `careers_url`.

const ALLOWED_GREENHOUSE_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
]);

/** @param {string} url */
function assertGreenhouseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`greenhouse: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`greenhouse: URL must use HTTPS: ${url}`);
  if (!ALLOWED_GREENHOUSE_HOSTS.has(parsed.hostname))
    throw new Error(`greenhouse: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_GREENHOUSE_HOSTS].join(', ')}`);
  return url;
}

// Greenhouse's list API omits the JD body unless `?content=true` is asked for,
// which inflates the payload roughly 20x (Anthropic: 290KB → 5.9MB). It stays
// opt-in per portals.yml entry (`fetch_content: true`) so only boards that
// actually need description-based filtering pay the cost.
const CONTENT_TIMEOUT_MS = 45_000;

/** @param {string} url */
function withContent(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('content', 'true');
  return parsed.toString();
}

/** @param {import('./_types.js').PortalEntry} entry */
function resolveApiUrl(entry) {
  const wantsContent = entry.fetch_content === true;
  if (entry.api) {
    assertGreenhouseUrl(entry.api);
    return wantsContent ? withContent(entry.api) : entry.api;
  }
  const url = entry.careers_url || '';
  const match = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (match) {
    const base = `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs`;
    return wantsContent ? withContent(base) : base;
  }
  return null;
}

// `content` arrives HTML-escaped (`&lt;p&gt;…`), so decode once to get real
// HTML, strip tags, then decode again for entities that were inside the text.
/** @param {any} raw */
function toPlainText(raw) {
  if (typeof raw !== 'string' || raw === '') return '';
  return decodeEntities(decodeEntities(raw).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @type {Provider} */
export default {
  id: 'greenhouse',

  detect(entry) {
    try {
      const apiUrl = resolveApiUrl(entry);
      return apiUrl ? { url: apiUrl } : null;
    } catch {
      return null;
    }
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`greenhouse: cannot derive API URL for ${entry.name}`);
    assertGreenhouseUrl(apiUrl);
    // redirect:'error' prevents SSRF via server-side redirects; combined with
    // assertGreenhouseUrl above it guarantees the final hostname stays in the allowlist.
    const wantsContent = entry.fetch_content === true;
    const json = /** @type {any} */ (await ctx.fetchJson(apiUrl, {
      redirect: 'error',
      ...(wantsContent ? { timeoutMs: CONTENT_TIMEOUT_MS } : {}),
    }));
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    return jobs.filter(/** @param {any} j */ j => j.absolute_url).map(/** @param {any} j */ j => ({
      title: j.title || '',
      url: j.absolute_url,
      company: entry.name,
      location: j.location?.name || '',
      postedAt: toEpochMs(j.first_published),
      description: wantsContent ? toPlainText(j.content) : '',
    }));
  },
};
