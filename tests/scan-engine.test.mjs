import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runScan } from '../scan-engine.mjs';

test('importing the engine in a fresh directory creates no files or environment changes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'career-ops-scan-import-'));
  try {
    const moduleUrl = pathToFileURL(join(process.cwd(), 'scan-engine.mjs')).href;
    const script = `const before = JSON.stringify(process.env); await import(${JSON.stringify(moduleUrl)}); process.stdout.write(JSON.stringify({ sameEnv: before === JSON.stringify(process.env), dataExists: (await import('node:fs')).existsSync('data') }));`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), { sameEnv: true, dataExists: false });
    assert.equal(existsSync(join(cwd, 'data')), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function memoryFs(seed = {}, events = []) {
  const files = new Map(Object.entries(seed));
  return {
    files,
    existsSync: (file) => files.has(file),
    mkdirSync: (dir) => events.push(`mkdir:${dir}`),
    readFileSync(file) {
      events.push(`read:${file}`);
      if (!files.has(file)) throw new Error(`missing file: ${file}`);
      return files.get(file);
    },
    writeFileSync(file, value) { events.push(`write:${file}`); files.set(file, String(value)); },
    appendFileSync(file, value) { events.push(`append:${file}`); files.set(file, (files.get(file) ?? '') + String(value)); },
  };
}

const quietReporter = { log() {}, error() {} };
const fixedClock = { now: () => new Date('2024-01-01T12:00:00.000Z') };

function scanAdapters(jobs, fileSystem, extra = {}) {
  const provider = { id: 'fixture', fetch: async () => { extra.events?.push('fetch'); return jobs; } };
  const providers = new Map([['fixture', provider]]);
  return {
    fs: fileSystem,
    clock: fixedClock,
    reporter: quietReporter,
    providers,
    providerRegistry: {
      loadProviders: async () => providers,
      mergeProviderPlugins: async () => {},
      resolveProvider: (entry, loaded) => ({ provider: loaded.get(entry.provider) }),
    },
    liveness: { verifyOffers: async (offers) => ({ verified: offers, expired: [], dropped: [], invalid: [], migrated: [] }) },
    createHttpContext: () => ({}),
    paths: {
      scanHistoryPath: 'state/scan-history.tsv',
      pipelinePath: 'state/pipeline.md',
      applicationsPath: 'state/applications.md',
      reportsDir: 'state/reports',
      blacklistPath: 'state/blacklist.md',
      profilePath: 'state/profile.yml',
      cvPath: 'state/cv.md',
      rankingSignalsPath: 'state/ranking-signals.yml',
      portalHealthPath: 'state/portal-health.tsv',
      scanRunsPath: 'state/scan-runs.tsv',
      dataDir: 'state',
    },
    ...extra,
  };
}

test('runScan orders fetch, filters, deduplicates, counts, and persists through injected adapters', async () => {
  const events = [];
  const fileSystem = memoryFs({ 'state/cv.md': 'React TypeScript frontend developer' }, events);
  const jobs = [
    { title: 'Frontend Engineer', url: 'https://jobs.example/a', company: 'Acme', location: 'Remote', postedAt: Date.parse('2025-01-01T00:00:00.000Z') },
    { title: 'Frontend Engineer', url: 'https://jobs.example/a', company: 'Acme', location: 'Remote' },
    { title: 'Product Designer', url: 'https://jobs.example/b', company: 'Acme', location: 'Remote' },
    { title: 'Frontend Engineer', url: 'https://jobs.example/c', company: 'Acme', location: 'Remote' },
  ];
  const result = await runScan({
    tracked_companies: [{ name: 'Acme', provider: 'fixture', careers_url: 'https://jobs.example/careers' }],
    title_filter: { positive: ['engineer'] },
  }, scanAdapters(jobs, fileSystem, { events }));

  assert.equal(result.date, '2024-01-01');
  assert.equal(result.found, 4);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].url, 'https://jobs.example/a');
  assert.equal(result.offers[0].fitComponents.freshness, 100, 'fit freshness should use the injected clock');
  assert.equal(result.stats.filteredTitle, 1);
  assert.equal(result.stats.dupes, 2);
  assert.match(fileSystem.files.get('state/pipeline.md'), /jobs\.example\/a/);
  assert.equal(fileSystem.files.get('state/scan-history.tsv').split('\n').length, 3);
  assert.match(fileSystem.files.get('state/scan-runs.tsv'), /2024-01-01T12:00:00\.000Z\tcompleted/);
  assert.ok(events.indexOf('fetch') !== -1 && events.indexOf('fetch') < events.findIndex((event) => event.startsWith('write:')));
  assert.ok(events.includes('read:state/cv.md'), 'fit scoring should use the injected filesystem adapter');
});

test('dry-run returns the same decision without writing through the filesystem adapter', async () => {
  const fileSystem = memoryFs();
  const jobs = [{ title: 'Frontend Engineer', url: 'https://jobs.example/a', company: 'Acme' }];
  const result = await runScan({
    tracked_companies: [{ name: 'Acme', provider: 'fixture' }],
    title_filter: { positive: ['engineer'] },
  }, scanAdapters(jobs, fileSystem, { options: { dryRun: true } }));

  assert.equal(result.offers.length, 1);
  assert.equal(fileSystem.files.size, 0);
});

test('liveness and reporter adapters control verification and preserve expired-history routing', async () => {
  const fileSystem = memoryFs();
  const logs = [];
  const job = { title: 'Frontend Engineer', url: 'https://jobs.example/expired', company: 'Acme' };
  let verificationCalls = 0;
  const result = await runScan({
    tracked_companies: [{ name: 'Acme', provider: 'fixture' }],
    title_filter: { positive: ['engineer'] },
  }, scanAdapters([job], fileSystem, {
    options: { verify: true },
    reporter: { log: (line) => logs.push(line), error() {} },
    liveness: {
      verifyOffers: async (offers) => {
        verificationCalls++;
        assert.deepEqual(offers.map((offer) => offer.url), [job.url]);
        return { verified: [], expired: [{ ...offers[0], reason: 'posting closed' }], dropped: [], invalid: [], migrated: [] };
      },
    },
  }));

  assert.equal(verificationCalls, 1);
  assert.equal(result.offers.length, 0);
  assert.equal(result.stats.expired, 1);
  assert.match(fileSystem.files.get('state/scan-history.tsv'), /skipped_expired/);
  assert.ok(logs.some((line) => line.includes('Verifying liveness')));
});

test('empty provider registry fails with an error instead of exiting the host process', async () => {
  const fileSystem = memoryFs();
  const adapters = scanAdapters([], fileSystem, { providers: new Map() });
  await assert.rejects(runScan({}, adapters), /no providers loaded/);
});

test('CLI dry-run keeps the established text summary shape', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'career-ops-scan-cli-'));
  try {
    const portalsPath = join(process.cwd(), 'templates', 'portals.example.yml');
    const cliPath = join(process.cwd(), 'scan.mjs');
    const child = spawnSync(process.execPath, [cliPath, '--dry-run', '--company', '__career_ops_no_match__'], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, CAREER_OPS_PORTALS: portalsPath },
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /^Scanning 0 companies/m);
    assert.match(child.stdout, /^Portal Scan — \d{4}-\d{2}-\d{2}$/m);
    assert.match(child.stdout, /^Total jobs found:\s+0$/m);
    assert.match(child.stdout, /^New offers added:\s+0$/m);
    assert.match(child.stdout, /^\(dry run — no files will be written\)$/m);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
