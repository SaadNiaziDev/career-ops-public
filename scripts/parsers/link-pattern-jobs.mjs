#!/usr/bin/env node
/**
 * Generic careers-page parser: keep only links whose URL matches a per-company
 * job-link pattern.
 *
 * Many employers run a bespoke careers page (WordPress, custom React, Zoho or
 * Jobvite embeds) with no public feed. Their job links are still recognizable
 * by URL shape (`/openings/{slug}/`, `/jobs-listing/{slug}`, `job-detail?job_id=`),
 * so one parser plus a regex in portals.yml covers them without nav/blog noise.
 *
 * Modes:
 *   default   static fetch of careers_url, parse <a href>…</a>
 *   --render  render with the repo's headless extractor (SPAs, bot-walled sites)
 *
 * Options:
 *   --pattern <regex>      REQUIRED. Tested against the absolute link URL.
 *   --company <name>       Company name for emitted jobs.
 *   --title-cut <regex>    Cut the link text at the first match (e.g. " Apply ").
 *   --title-span <n>       Static mode: use the n-th <span> inside the link as the
 *                          title (cards that bundle department + title + teaser).
 *   --objectid-date        Derive postedAt from a 24-hex Mongo ObjectId in the URL
 *                          (first 4 bytes are the creation timestamp).
 *   --max <n>              Extractor link cap in --render mode (default 150).
 *
 * Emits jobs-json-v1 ({ jobs: [...] }) on stdout.
 *
 * Usage: node scripts/parsers/link-pattern-jobs.mjs <careers_url> --pattern '<regex>' [options]
 */

import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = new Set(['--pattern', '--company', '--title-cut', '--title-span', '--max']);
const careersUrl = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1]));
const company = flag('--company');
const render = args.includes('--render');
const objectIdDate = args.includes('--objectid-date');
const max = flag('--max') || '150';
const titleSpan = Number(flag('--title-span')) || 0;

function fail(error, code) {
  process.stdout.write(JSON.stringify({ error, code }));
  process.exit(1);
}

const decode = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
  .replace(/&#8211;|&ndash;/g, '-').replace(/&nbsp;|&#160;/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function staticLinks(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const links = [];
  for (const [, href, inner] of html.matchAll(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let abs;
    try { abs = new URL(decode(href), res.url).href; } catch { continue; }
    let title = decode(inner);
    if (titleSpan > 0) {
      const spans = [...inner.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => decode(m[1]));
      if (spans[titleSpan - 1]) title = spans[titleSpan - 1];
    }
    links.push({ url: abs, title });
  }
  return links;
}

async function renderedLinks(url) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(REPO_ROOT, 'browser-extract.mjs'), url, '--mode', 'listing', '--max', max],
    { cwd: REPO_ROOT, timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
  );
  const data = JSON.parse(stdout);
  if (data.error) throw new Error(data.error);
  return (data.jobs || []).map((j) => ({ url: j.url, title: j.title || '' }));
}

/** Humanize `?title=2416-senior-manager` or the last path segment when a link has no text. */
function titleFromUrl(url) {
  const u = new URL(url);
  const raw = u.searchParams.get('title') || u.pathname.split('/').filter(Boolean).pop() || '';
  const words = decodeURIComponent(raw).replace(/^\d+[-_]/, '').split(/[-_]+/).filter(Boolean);
  if (words.length < 2) return '';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function dateFromObjectId(url) {
  const hex = url.match(/(?:^|[^0-9a-f])([0-9a-f]{24})(?:[^0-9a-f]|$)/i)?.[1];
  if (!hex) return undefined;
  const secs = parseInt(hex.slice(0, 8), 16);
  // Sanity window: 2015-01-01 .. now + 1 day.
  if (secs < 1420070400 || secs > Date.now() / 1000 + 86400) return undefined;
  return new Date(secs * 1000).toISOString().slice(0, 10);
}

async function main() {
  if (!careersUrl) fail('missing careers_url', 'bad_args');
  const patternSrc = flag('--pattern');
  if (!patternSrc) fail('missing --pattern', 'bad_args');
  let pattern;
  let cut;
  try {
    pattern = new RegExp(patternSrc, 'i');
    cut = flag('--title-cut') ? new RegExp(flag('--title-cut'), 'i') : null;
  } catch (err) {
    fail(`bad regex: ${err.message}`, 'bad_args');
  }
  try {
    const u = new URL(careersUrl);
    if (u.protocol !== 'https:') throw new Error('careers_url must be https');
  } catch (err) {
    fail(err.message, 'bad_args');
  }

  const links = render ? await renderedLinks(careersUrl) : await staticLinks(careersUrl);
  const byUrl = new Map();
  for (const link of links) {
    if (!/^https:\/\//i.test(link.url) || !pattern.test(link.url)) continue;
    let title = link.title;
    if (cut) title = title.split(cut)[0];
    title = title.replace(/^(view|apply|details?|read more)\s*[:\-–]?\s*/i, '').trim();
    if (!title || /^(apply|view|details|read more|learn more)$/i.test(title)) title = titleFromUrl(link.url);
    if (!title || title.length < 3 || /^(apply|view|details|read more|learn more)$/i.test(title)) continue;
    const url = link.url.replace(/#.*$/, '');
    const prev = byUrl.get(url);
    // Pages often repeat a job link (title card + "Apply" button); keep the longest text.
    if (prev && prev.title.length >= title.length) continue;
    const postedAt = objectIdDate ? dateFromObjectId(url) : undefined;
    byUrl.set(url, { title, url, ...(company ? { company } : {}), location: '', ...(postedAt ? { postedAt } : {}) });
  }
  process.stdout.write(JSON.stringify({ jobs: [...byUrl.values()] }));
}

main().catch((err) => fail(err.message, 'fetch_error'));
