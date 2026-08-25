#!/usr/bin/env node
/**
 * JazzHR (*.applytojob.com) board parser.
 *
 * JazzHR renders boards server-side, so a plain fetch is enough — no headless
 * browser needed. Boards ship in one of two layouts and companies use both:
 *
 *   list  — <li class="list-group-item"> rows, location in a fa-map-marker <li>
 *   table — <tr class="resumator-table-row-*"> rows, location in its own <td>
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/jazzhr-jobs.mjs <careers_url> [--company Name]
 */

const args = process.argv.slice(2);
const careersUrl = args.find((a) => !a.startsWith('--'));

if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'missing careers_url', code: 'bad_args' }));
  process.exit(1);
}

const companyIdx = args.indexOf('--company');
const company = companyIdx !== -1 ? args[companyIdx + 1] : undefined;

const JOB_HREF = /href="(https?:\/\/[^"]*?\.applytojob\.com\/apply\/[A-Za-z0-9]+\/[^"]*)"/i;
const ANCHOR_TEXT = /<a\b[^>]*>([\s\S]*?)<\/a>/i;
const LIST_LOCATION = /fa-map-marker['"]?><\/i>\s*([^<]+)/i;
const TABLE_LOCATION = /<td[^>]*resumator-job-location-column[^>]*>([\s\S]*?)<\/td>/i;

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

/** Split the board into row chunks, so no regex ever spans two jobs. */
function splitRows(html) {
  const listRows = html.split(/<li\s+class=["']list-group-item["']/i).slice(1);
  const tableRows = html.split(/<tr\s+class=["']resumator-table-row-/i).slice(1);
  return [
    ...listRows.map((r) => ({ chunk: r, layout: 'list' })),
    ...tableRows.map((r) => ({ chunk: r, layout: 'table' })),
  ];
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

  for (const { chunk, layout } of splitRows(html)) {
    const href = chunk.match(JOB_HREF);
    if (!href) continue;

    const url = href[1];
    if (seen.has(url)) continue;

    const anchor = chunk.match(ANCHOR_TEXT);
    const title = anchor ? decode(anchor[1]) : '';
    // Board chrome (e.g. the "back" control) matches the href shape but is untitled.
    if (!title) continue;

    seen.add(url);

    const loc = chunk.match(layout === 'table' ? TABLE_LOCATION : LIST_LOCATION);
    jobs.push({
      title,
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
