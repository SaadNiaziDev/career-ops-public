const TRACKING_PARAMS = [
  /^utm_/i,
  /^hsa_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^msclkid$/i,
  /^gh_src$/i,
  /^source$/i,
  /^ref$/i,
  /^referrer$/i,
  /^campaign$/i,
  /^location$/i,
  /^department$/i,
  /^gh_jid$/i,
];

function cleanPath(pathname) {
  return pathname
    .replace(/\/(?:apply|application)\/?$/i, '')
    .replace(/\.md$/i, '')
    .replace(/\/+$/g, '');
}

function atsPath(host, pathname) {
  const path = cleanPath(pathname);
  const parts = path.split('/').filter(Boolean);

  if (host === 'job-boards.greenhouse.io') host = 'boards.greenhouse.io';
  if (host === 'boards.greenhouse.io' || host === 'boards-api.greenhouse.io') {
    const jobs = parts.findIndex((p) => p.toLowerCase() === 'jobs');
    if (jobs > 0 && parts[jobs + 1]) return { host: 'boards.greenhouse.io', path: `/${parts[0].toLowerCase()}/jobs/${parts[jobs + 1]}` };
  }

  if (host.endsWith('lever.co')) {
    const jobs = parts.findIndex((p) => p.toLowerCase() === 'jobs');
    if (jobs > 0 && parts[jobs + 1]) return { host: 'jobs.lever.co', path: `/${parts[0].toLowerCase()}/${parts[jobs + 1]}` };
  }

  if (host === 'jobs.ashbyhq.com' && parts.length >= 2) {
    return { host, path: `/${parts[0].toLowerCase()}/${parts[1]}` };
  }

  if (host === 'apply.workable.com' && parts.length >= 2) {
    return { host, path: `/${parts[0].toLowerCase()}/j/${parts[parts.length - 1].toLowerCase()}` };
  }

  if (host.endsWith('myworkdayjobs.com') || host.endsWith('wd1.myworkdaysite.com') || host.endsWith('wd3.myworkdaysite.com')) {
    const job = [...parts].reverse().find((p) => /[jr]r[-_A-Z0-9]*\d/i.test(p) || /\d{4,}/.test(p));
    if (job) return { host: host.replace(/^.+?\.myworkdayjobs\.com$/i, 'myworkdayjobs.com'), path: `/${job.toLowerCase()}` };
  }

  return { host, path: path.toLowerCase() || '/' };
}

export function normalizeVacancyUrl(raw) {
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    let host = url.hostname.toLowerCase().replace(/^www\./, '');
    const ats = atsPath(host, url.pathname);
    host = ats.host;
    const kept = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (TRACKING_PARAMS.some((re) => re.test(key))) continue;
      if (value.trim()) kept.append(key.toLowerCase(), value.trim());
    }
    kept.sort();
    const query = kept.toString();
    return `${host}${ats.path}${query ? `?${query}` : ''}`;
  } catch {
    const s = String(raw ?? '').trim().toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
    return s || null;
  }
}

export function vacancyIdFromUrl(raw) {
  const normalized = normalizeVacancyUrl(raw);
  return normalized ? `url:${normalized}` : null;
}

export function vacancyFingerprint({ company = '', role = '' } = {}) {
  const clean = (value) => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const c = clean(company);
  const r = clean(role);
  return c && r ? `fingerprint:${c}|${r}` : null;
}
