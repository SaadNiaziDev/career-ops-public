#!/usr/bin/env node
/** Extract a company's server-rendered Kanvis listings for scan.mjs. */

const careersUrl = process.argv[2];
let board;
try {
  board = new URL(careersUrl);
  if (board.protocol !== 'https:' || board.hostname !== 'www.kanvis.me' || !/^\/jobs\/at\/[^/]+\/?$/.test(board.pathname)) {
    throw new Error('expected a Kanvis company jobs URL');
  }
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.message, code: 'bad_url' }));
  process.exit(1);
}

try {
  const response = await fetch(board, { headers: { 'user-agent': 'Mozilla/5.0 (career-ops scan)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();

  // Next.js embeds the same job data used to render the visible cards.
  const rsc = [...html.matchAll(/<script>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)]
    .map((match) => {
      try { return JSON.parse(match[1])[1]; } catch { return ''; }
    })
    .join('');
  const payload = rsc.match(/"jobs":(\[[\s\S]*?\]),"gated":/);
  if (!payload) throw new Error('Kanvis job data not found');
  const records = JSON.parse(payload[1]);
  if (!Array.isArray(records)) throw new Error('Kanvis jobs were not an array');

  const jobs = records.map((job) => ({
    title: job.title,
    url: new URL(`/jobs/${encodeURIComponent(job.handle)}`, board.origin).href,
    location: job.location_text || job.location_country || '',
    postedAt: job.posted_at || undefined,
  })).filter((job) => job.title && job.url);
  process.stdout.write(JSON.stringify({ jobs }));
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.message, code: 'fetch_error' }));
  process.exit(1);
}
