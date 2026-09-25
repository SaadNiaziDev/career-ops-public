#!/usr/bin/env node

/** CLI adapter for the import-safe portal scan engine. */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import yaml from 'js-yaml';
import { runScan } from './scan-engine.mjs';

// Keep the scanner helpers historically imported by scan-ats-full and tests.
export * from './scan-engine.mjs';

async function loadDotenv() {
  try {
    const { config } = await import('dotenv');
    config({ quiet: true });
  } catch {
    // dotenv is optional; existing process.env values remain available.
  }
}

function parseOptions(args) {
  const throttleArg = args.find((arg) => arg === '--throttle' || arg.startsWith('--throttle='));
  const companyFlag = args.indexOf('--company');
  return {
    dryRun: args.includes('--dry-run'),
    verify: args.includes('--verify'),
    headedFallback: args.includes('--headed-fallback'),
    throttleBaseMs: throttleArg ? (Number(throttleArg.split('=')[1]) || 5000) : 0,
    rediscover: args.includes('--rediscover-404'),
    includeBlacklisted: args.includes('--include-blacklisted'),
    company: companyFlag === -1 ? null : args[companyFlag + 1] ?? null,
    quiet: args.includes('--quiet'),
  };
}

async function main() {
  await loadDotenv();
  const options = parseOptions(process.argv.slice(2));
  const portalsPath = process.env.CAREER_OPS_PORTALS || 'portals.yml';
  const profilePath = process.env.CAREER_OPS_PROFILE || 'config/profile.yml';
  if (!existsSync(portalsPath)) {
    console.error('Error: portals.yml not found. Run onboarding first.');
    process.exitCode = 1;
    return;
  }

  let config;
  try {
    config = yaml.load(readFileSync(portalsPath, 'utf-8'));
  } catch (error) {
    console.error(`Error: failed to parse ${portalsPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const result = await runScan(config, {
    options,
    paths: { profilePath },
  });

  // Preserve the one-time interactive note in the CLI layer; programmatic runs
  // stay deterministic and do not create an unrequested marker file.
  if (!options.dryRun && process.stdout.isTTY && !options.quiet && !existsSync('.manifesto-noted')) {
    const osc8 = ['iTerm.app', 'WezTerm', 'vscode', 'ghostty', 'Hyper', 'Tabby'].includes(process.env.TERM_PROGRAM)
      || Boolean(process.env.WT_SESSION) || Boolean(process.env.KITTY_WINDOW_ID)
      || Number.parseInt(process.env.VTE_VERSION || '0', 10) >= 5000;
    const link = osc8
      ? '\x1b]8;;https://career-ops.org/manifesto?utm_source=cli\x1b\\career-ops.org/manifesto\x1b]8;;\x1b\\'
      : 'career-ops.org/manifesto?utm_source=cli';
    console.log(`\nthe practice behind this tool has a name and a manifesto: ${link}`);
    try { writeFileSync('.manifesto-noted', new Date().toISOString() + '\n'); } catch { /* best-effort */ }
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    if (error.message === 'no providers loaded from providers/') {
      console.error('Error: no providers loaded from providers/');
    } else {
      console.error('Fatal:', error.message);
    }
    process.exitCode = 1;
  });
}
