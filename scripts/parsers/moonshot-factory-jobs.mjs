#!/usr/bin/env node
/** Extract email-apply roles from The Moonshot Factory careers page for scan.mjs. */

const careersUrl = process.argv[2];
if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'careers url required', code: 'bad_url' }));
  process.exit(1);
}

const res = await fetch(careersUrl, { signal: AbortSignal.timeout(30000) });
if (!res.ok) {
  process.stdout.write(JSON.stringify({ error: `HTTP ${res.status}`, code: 'http_error' }));
  process.exit(1);
}
const html = await res.text();

const decode = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const jobs = [];
const seen = new Set();
for (const [, id, title_] of html.matchAll(/ROLE-(\d+)<\/span>\s*<span><span class="role-t">([\s\S]*?)<\/span>/g)) {
  const title = decode(title_);
  if (!title || seen.has(title)) continue;
  seen.add(title);
  jobs.push({
    title,
    url: `${new URL(careersUrl).origin}/careers.html#role-${id}`,
    location: 'Remote (Anywhere)',
  });
}
process.stdout.write(JSON.stringify({ jobs }));
