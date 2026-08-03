#!/usr/bin/env node

/**
 * verify-public-release.mjs — privacy gate before publishing a public artifact.
 *
 * Fails if tracked files include user-layer data, runtime worker logs, personal
 * identifiers, or absolute home paths.
 *
 * Usage:
 *   node verify-public-release.mjs
 */

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

const USER_LAYER_PATTERNS = [
  /^cv\.md$/,
  /^config\/profile\.yml$/,
  /^modes\/_profile\.md$/,
  /^modes\/_custom\.md$/,
  /^portals\.yml$/,
  /^article-digest\.md$/,
  /^voice-dna\.md$/,
  /^data\//,
  /^reports\//,
  /^output\//,
  /^jds\//,
  /^writing-samples\//,
  /^interview-prep\//,
  /^\.career-ops-web\/runs\//,
  /^templates\/cv-template\.[^/]+\.html$/,
];

const SCAFFOLD_OK = /(^|\/)\.gitkeep$|(^|\/)README\.md$/;

const FORBIDDEN_CONTENT = [
  { label: 'personal email', pattern: /devsaadk@gmail\.com/i },
  { label: 'personal phone', pattern: /316\s*642/i },
  { label: 'home path', pattern: /\/Users\/saadalikhan\//i },
  { label: 'private worker log', pattern: /\.career-ops-web\/runs\/job-/i },
  { label: 'personal CV template', pattern: /cv-template\.saads-simple\.html/i },
];

function gitLines(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const tracked = gitLines(['ls-files', '-z'])
  .length > 0
  ? execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf-8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  : [];

let failed = false;

for (const file of tracked) {
  if (SCAFFOLD_OK.test(file)) continue;
  if (USER_LAYER_PATTERNS.some((re) => re.test(file))) {
    console.error(`❌ tracked user-layer file: ${file}`);
    failed = true;
  }
}

for (const file of tracked) {
  if (!/\.(md|yml|html|mjs|tsx?|json|sh)$/i.test(file)) continue;
  let text = '';
  try {
    text = readFileSync(join(ROOT, file), 'utf-8');
  } catch {
    continue;
  }
  for (const { label, pattern } of FORBIDDEN_CONTENT) {
    if (pattern.test(text)) {
      console.error(`❌ ${label} found in tracked file: ${file}`);
      failed = true;
    }
  }
}

const absHits = gitLines(['grep', '-l', '/Users/', '--', ...tracked.filter((f) => /\.(md|yml|html|mjs|tsx?|json|sh)$/i.test(f))]);
for (const file of absHits) {
  if (file.includes('test-all.mjs') || file.includes('verify-public-release.mjs')) continue;
  console.error(`❌ absolute home path in tracked file: ${file}`);
  failed = true;
}

if (failed) {
  console.error('\nPublic release verification failed.');
  process.exit(1);
}

console.log('✅ Public release verification passed');
