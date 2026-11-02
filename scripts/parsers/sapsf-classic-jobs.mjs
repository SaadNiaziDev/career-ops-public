#!/usr/bin/env node
/**
 * Classic SAP SuccessFactors career portal parser (career{N}.sapsf.eu/com).
 *
 * Older BizX tenants (e.g. Systems Limited: career55.sapsf.eu, company=systemvent)
 * are not RMK/CSB sites, so providers/successfactors.mjs cannot read them. The
 * classic portal exposes a public XML listing:
 *   GET {origin}/career?company={id}&career_ns=job_listing_summary&resultType=XML
 * → <Job-Listing><Job><JobTitle/><ReqId/><Posted-Date>MM/DD/YYYY</Posted-Date>…
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout, with postedAt (ISO date).
 *
 * Usage: node scripts/parsers/sapsf-classic-jobs.mjs <careers_url> [--company Name]
 *   careers_url must carry ?company={id} on a *.sapsf.eu / *.sapsf.com host.
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const company = flag('--company');

const SAPSF_HOST_RE = /^career\d*\.sapsf\.(eu|com)$/i;

function fail(error, code) {
  process.stdout.write(JSON.stringify({ error, code }));
  process.exit(1);
}

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? decode(m[1]) : '';
}

/** MM/DD/YYYY → YYYY-MM-DD, or '' when unparseable. */
function isoDate(us) {
  const m = us.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
}

async function main() {
  if (!careersUrl) fail('missing careers_url', 'bad_args');
  let parsed;
  try {
    parsed = new URL(careersUrl);
  } catch {
    fail(`invalid URL: ${careersUrl}`, 'bad_args');
  }
  if (parsed.protocol !== 'https:' || !SAPSF_HOST_RE.test(parsed.hostname)) {
    fail(`not a classic SuccessFactors portal: ${careersUrl}`, 'bad_args');
  }
  const tenant = parsed.searchParams.get('company');
  if (!tenant) fail('careers_url is missing ?company=', 'bad_args');

  const feed = new URL('/career', parsed.origin);
  feed.searchParams.set('company', tenant);
  feed.searchParams.set('career_ns', 'job_listing_summary');
  feed.searchParams.set('resultType', 'XML');

  const res = await fetch(feed, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) fail(`HTTP ${res.status}`, 'http_error');
  const xml = await res.text();
  if (!xml.includes('<Job-Listing')) fail('unexpected response (no <Job-Listing>)', 'parse_error');

  const jobs = [];
  for (const [, block] of xml.matchAll(/<Job>([\s\S]*?)<\/Job>/g)) {
    const title = tag(block, 'JobTitle');
    const reqId = tag(block, 'ReqId');
    if (!title || !/^\d+$/.test(reqId)) continue;
    const url = new URL('/career', parsed.origin);
    url.searchParams.set('career_ns', 'job_listing');
    url.searchParams.set('company', tenant);
    url.searchParams.set('navBarLevel', 'JOB_SEARCH');
    url.searchParams.set('career_job_req_id', reqId);
    const postedAt = isoDate(tag(block, 'Posted-Date'));
    jobs.push({
      title,
      url: url.href,
      ...(company ? { company } : {}),
      location: '',
      ...(postedAt ? { postedAt } : {}),
    });
  }
  process.stdout.write(JSON.stringify({ jobs }));
}

main().catch((err) => fail(err.message, 'fetch_error'));
