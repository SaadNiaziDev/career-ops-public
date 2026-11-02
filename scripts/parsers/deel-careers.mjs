#!/usr/bin/env node

/** Reads the public job data embedded in Deel's careers page. */
const careersUrl = process.argv[2];
if (!careersUrl) {
  process.stdout.write(JSON.stringify({ error: 'missing careers_url', code: 'bad_args' }));
  process.exit(1);
}

function readBalancedArray(source, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '[') depth += 1;
    else if (char === ']' && --depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

try {
  const parsedUrl = new URL(careersUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'www.deel.com') {
    throw new Error(`not an official Deel careers URL: ${careersUrl}`);
  }
  const response = await fetch(parsedUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; career-ops portal scanner)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const scripts = html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g);
  let entries = [];
  for (const match of scripts) {
    const rsc = JSON.parse(`"${match[1]}"`);
    const marker = '"__component":"product.career-job-listing","jobs":';
    const componentIndex = rsc.indexOf(marker);
    if (componentIndex < 0) continue;
    const arrayStart = rsc.indexOf('[', componentIndex + marker.length);
    const arrayText = readBalancedArray(rsc, arrayStart);
    if (!arrayText) throw new Error('incomplete embedded jobs data');
    entries = JSON.parse(arrayText);
    break;
  }
  if (!entries.length) throw new Error('Deel jobs data not found in careers page');

  const jobs = entries.map(({ attributes: job }) => {
    if (!job || job.is_listed !== true || !job.title || !job.ashby_id) return null;
    const locations = [...new Set([
      ...(Array.isArray(job.locations_list) ? job.locations_list.map((item) => item?.location) : []),
      ...(typeof job.all_locations === 'string' ? job.all_locations.split(/,\s*/) : []),
      job.location_name,
    ].filter((value) => typeof value === 'string' && value.trim()))];
    return {
      title: job.title,
      url: `https://www.deel.com/careers/job/${encodeURIComponent(job.ashby_id)}/`,
      location: locations.join(', '),
      ...(job.ashby_published_date ? { postedAt: job.ashby_published_date } : {}),
      company: 'Deel',
    };
  }).filter(Boolean);
  process.stdout.write(JSON.stringify({ jobs }));
} catch (error) {
  process.stderr.write(`${error.message || error}\n`);
  process.stdout.write(JSON.stringify({ error: String(error.message || error), code: 'fetch_error' }));
  process.exit(1);
}
