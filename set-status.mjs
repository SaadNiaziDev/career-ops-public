#!/usr/bin/env node

/** CLI adapter for the shared, import-safe tracker mutation API. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTrackerPath } from './tracker-utils.mjs';
import { setTrackerStatus } from './tracker-mutations.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const EXIT = { ok: 0, usage: 1, notFound: 2, ambiguous: 3, lockTimeout: 4 };
const USAGE = 'Usage: node set-status.mjs <report#|company> <state> [--note "..."] [--role "..."] [--force] [--dry-run] [--json]';
const args = process.argv.slice(2);
const positional = [];
const flags = { note: null, role: null, force: false, dryRun: false, json: false };

function fail(exitKey, jsonCode, message, extra = {}) {
  if (args.includes('--json')) console.log(JSON.stringify({ error: message, code: jsonCode, ...extra }));
  console.error(`❌ ${message}`);
  process.exit(EXIT[exitKey] ?? EXIT.usage);
}

for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--note' || arg === '--role') {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail('usage', 'usage', `Missing value for ${arg}`);
    flags[arg === '--note' ? 'note' : 'role'] = value;
    index++;
  } else if (arg === '--force') flags.force = true;
  else if (arg === '--dry-run') flags.dryRun = true;
  else if (arg === '--json') flags.json = true;
  else if (arg.startsWith('--')) fail('usage', 'usage', `Unknown flag: ${arg}`);
  else positional.push(arg);
}

if (positional.length !== 2) fail('usage', 'usage', `${USAGE}\nExpected 2 arguments: <report#|company> <state>`);
const [selector, status] = positional;
const trackerPath = resolveTrackerPath(ROOT);
let result;
try {
  result = await setTrackerStatus({
    trackerPath,
    statesPath: join(ROOT, 'templates/states.yml'),
    selector,
    status,
    role: flags.role,
    force: flags.force,
    note: flags.note,
    dryRun: flags.dryRun,
  });
} catch (error) {
  const key = error.code === 'LOCK_TIMEOUT' ? 'lockTimeout'
    : error.code === 'no-tracker' || error.code === 'not-found' ? 'notFound'
      : error.code === 'ambiguous' || error.code === 'report-number-mismatch' ? 'ambiguous'
        : 'usage';
  const jsonCode = error.code === 'LOCK_TIMEOUT' ? 'lock-timeout' : error.code || 'write-failure';
  fail(key, jsonCode, error.message, { ...(error.candidates ? { candidates: error.candidates } : {}), ...(error.trackerNum ? { trackerNum: error.trackerNum } : {}), ...(error.reportNums ? { reportNums: error.reportNums } : {}) });
}

const output = {
  ...result,
  newStatus: result.status,
  ...(flags.note != null ? { note: flags.note } : {}),
  ...(flags.dryRun ? { dryRun: true } : {}),
  ...(result.changed && result.status === 'Applied' ? { followupSeedCandidate: true } : {}),
  tracker: trackerPath,
};
if (flags.json) console.log(JSON.stringify(output, null, 2));
else {
  const verb = flags.dryRun ? 'would set' : result.changed ? 'set' : 'already';
  console.log(`✅ #${result.num} ${result.company} — ${result.role}: ${verb} ${result.oldStatus} → ${result.status}${flags.note ? ` (note: ${flags.note})` : ''}`);
  if (result.changed && !flags.dryRun && result.status === 'Applied') {
    console.error('ℹ️  Status is Applied — consider seeding follow-ups in data/follow-ups.md (#1430: node followup-cadence.mjs)');
  }
}
process.exit(EXIT.ok);
