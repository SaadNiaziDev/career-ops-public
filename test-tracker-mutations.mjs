import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { deleteTrackerRow, mutateTracker, setTrackerPdfFlag, setTrackerRole, setTrackerStatus } from './tracker-mutations.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

test('status updates use the shared mutation API and preserve unrelated tracker data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-tracker-mutations-'));
  const trackerPath = path.join(dir, 'applications.md');
  const original = [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 12 | 2026-09-23 | Example Co | Engineer | 4.2/5 | Evaluated | ❌ | [12](reports/012-example.md) | preserve this |',
    '',
  ].join('\n');
  fs.writeFileSync(trackerPath, original);

  try {
    const result = await setTrackerStatus({
      trackerPath,
      statesPath: path.resolve('templates/states.yml'),
      selector: '12',
      status: 'Applied',
    });

    assert.equal(result.status, 'Applied');
    assert.match(fs.readFileSync(trackerPath, 'utf8'), /\| 12 \| 2026-09-23 \| Example Co \| Engineer \| 4\.2\/5 \| Applied \|/);
    assert.match(fs.readFileSync(trackerPath, 'utf8'), /preserve this/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('separate processes serialize read-modify-write operations without losing updates', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-tracker-race-'));
  const trackerPath = path.join(dir, 'applications.md');
  fs.writeFileSync(trackerPath, '# tracker\n');
  const worker = `import { mutateTracker } from ${JSON.stringify(new URL('./tracker-mutations.mjs', import.meta.url).href)};
    await mutateTracker(process.env.TRACKER_PATH, async (content) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { content: content + process.env.TRACKER_TAG + '\\n', value: true };
    });`;
  const run = (tag) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', worker], {
      cwd: process.cwd(),
      env: { ...process.env, TRACKER_PATH: trackerPath, TRACKER_TAG: tag },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`worker exited ${code}: ${stderr}`)));
  });

  try {
    await Promise.all([run('first'), run('second')]);
    const result = fs.readFileSync(trackerPath, 'utf8');
    assert.match(result, /first/);
    assert.match(result, /second/);
    assert.ok(['# tracker\nfirst\n', '# tracker\nsecond\n'].includes(fs.readFileSync(`${trackerPath}.bak`, 'utf8')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('PDF flag and delete operations use the same import-safe mutation API', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-tracker-ops-'));
  const trackerPath = path.join(dir, 'applications.md');
  fs.writeFileSync(trackerPath, [
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 20 | 2026-09-23 | Example Co | Engineer | 4.2/5 | Applied | ❌ | [20](reports/020-example.md) | keep |',
    '| 21 | 2026-09-23 | Another Co | Analyst | 4.0/5 | Evaluated | ❌ | [21](reports/021-another.md) | keep |',
    '',
  ].join('\n'));
  try {
    await setTrackerPdfFlag({ trackerPath, selector: '20', value: '✅' });
    const role = await setTrackerRole({ trackerPath, selector: '20', role: 'Senior Engineer' });
    assert.equal(role.changed, true);
    const removed = await deleteTrackerRow({ trackerPath, selector: '21' });
    assert.equal(removed.removed, true);
    const content = fs.readFileSync(trackerPath, 'utf8');
    assert.match(content, /\| 20 \|.*\| ✅ \|/);
    assert.match(content, /Senior Engineer/);
    assert.doesNotMatch(content, /Another Co/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the PDF prompt command adapter updates a tracker through the shared API', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-pdf-flag-cli-'));
  const trackerPath = path.join(dir, 'applications.md');
  fs.writeFileSync(trackerPath, [
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 31 | 2026-09-23 | Example Co | Engineer | 4.2/5 | Applied | ❌ | [31](reports/031-example.md) | — |',
    '',
  ].join('\n'));
  try {
    const result = spawnSync(process.execPath, ['tracker-mutations.mjs', 'pdf', '--num', '31', '--value', '✅'], {
      cwd: ROOT,
      env: { ...process.env, CAREER_OPS_TRACKER: trackerPath },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(trackerPath, 'utf8'), /\| 31 \|.*\| ✅ \|/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the role prompt command adapter updates a tracker through the shared API', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-role-cli-'));
  const trackerPath = path.join(dir, 'applications.md');
  fs.writeFileSync(trackerPath, [
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 32 | 2026-09-23 | Example Co | Engineer | 4.2/5 | Applied | ❌ | [32](reports/032-example.md) | — |',
    '',
  ].join('\n'));
  try {
    const result = spawnSync(process.execPath, ['tracker-mutations.mjs', 'role', '--num', '32', '--value', 'Staff Engineer'], {
      cwd: ROOT,
      env: { ...process.env, CAREER_OPS_TRACKER: trackerPath },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(trackerPath, 'utf8'), /Staff Engineer/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
