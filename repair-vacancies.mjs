#!/usr/bin/env node

import { existsSync, readFileSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { normalizeVacancyUrl } from './vacancy-identity.mjs';
import { writeFileAtomic } from './tracker-utils.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PIPELINE_FILE = join(ROOT, 'data/pipeline.md');
const REPORTS_DIR = join(ROOT, 'reports');
const APPLY = process.argv.includes('--apply');

function reportUrl(reportNum) {
  if (!existsSync(REPORTS_DIR)) return null;
  const files = readFileSync(join(ROOT, 'data/applications.md'), 'utf8').match(/\[(\d+)\]\((?:\.\.\/)?reports\/[^)]+\.md\)/g) || [];
  const link = files.find((s) => parseInt(s.match(/\[(\d+)\]/)?.[1] || '', 10) === reportNum);
  const file = link?.match(/\]\((?:\.\.\/)?reports\/([^)]+\.md)\)/)?.[1];
  if (!file) return null;
  try {
    const body = readFileSync(join(REPORTS_DIR, file), 'utf8');
    return body.match(/^\*\*URL:\*\*\s*<?(https?:\/\/[^\s>]+)>?/im)?.[1] ?? null;
  } catch {
    return null;
  }
}

function evaluatedVacancies() {
  const out = new Map();
  const apps = existsSync(join(ROOT, 'data/applications.md')) ? readFileSync(join(ROOT, 'data/applications.md'), 'utf8') : '';
  for (const line of apps.split('\n')) {
    const n = parseInt(line.split('|')[1]?.trim() || '', 10);
    if (!Number.isFinite(n)) continue;
    const url = reportUrl(n);
    const key = url ? normalizeVacancyUrl(url) : null;
    if (key) out.set(key, n);
  }
  return out;
}

function pendingUrl(line) {
  const m = line.match(/^\s*-\s*\[ \]\s*(https?:\/\/[^\s|)]+)/i);
  return m?.[1] ?? null;
}

if (!existsSync(PIPELINE_FILE)) {
  console.log('No data/pipeline.md found.');
  process.exit(0);
}

const evaluated = evaluatedVacancies();
const lines = readFileSync(PIPELINE_FILE, 'utf8').split(/\r?\n/);
const seenPending = new Set();
const remove = new Set();
const findings = [];

for (let i = 0; i < lines.length; i++) {
  const url = pendingUrl(lines[i]);
  if (!url) continue;
  const key = normalizeVacancyUrl(url) ?? url;
  const n = evaluated.get(key);
  if (n) {
    remove.add(i);
    findings.push(`pending already evaluated as #${n}: ${url}`);
    continue;
  }
  if (seenPending.has(key)) {
    remove.add(i);
    findings.push(`duplicate pending URL: ${url}`);
    continue;
  }
  seenPending.add(key);
}

console.log(`Vacancy repair: ${findings.length} issue${findings.length === 1 ? '' : 's'} found.`);
for (const finding of findings) console.log(`- ${finding}`);

if (!APPLY || remove.size === 0) {
  if (!APPLY && remove.size > 0) console.log('Run with --apply to remove stale pending rows.');
  process.exit(0);
}

copyFileSync(PIPELINE_FILE, `${PIPELINE_FILE}.pre-vacancy-repair.bak`);
writeFileAtomic(PIPELINE_FILE, lines.filter((_, i) => !remove.has(i)).join('\n'));
console.log(`Updated data/pipeline.md (backup: data/pipeline.md.pre-vacancy-repair.bak).`);
