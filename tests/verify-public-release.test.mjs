// Regression coverage for tracked files that remain publishable after being ignored.
import { execFileSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fail, pass, ROOT } from './helpers.mjs';

function runVerifierWithTrackedFiles(files) {
  const repo = mkdtempSync(join(tmpdir(), 'career-ops-public-check-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    writeFileSync(join(repo, '.gitignore'), '*.bak\nconfig/profile.yml\n');
    copyFileSync(join(ROOT, 'verify-public-release.mjs'), join(repo, 'verify-public-release.mjs'));
    for (const file of files) {
      const fullPath = join(repo, file);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, 'fixture only; no personal data');
      execFileSync('git', ['add', '-f', file], { cwd: repo });
    }
    try {
      execFileSync(process.execPath, ['verify-public-release.mjs'], { cwd: repo, encoding: 'utf8' });
      return { code: 0, output: '' };
    } catch (error) {
      return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

console.log('\nverify-public-release.mjs — rejects tracked ignored user files');

for (const [file, label] of [
  ['config/profile.yml.bak-2026-01-01', 'tracked ignored profile backup is rejected'],
  ['config/profile.yml', 'tracked ignored profile file is rejected'],
]) {
  try {
    const result = runVerifierWithTrackedFiles([file]);
    if (result.code !== 0 && result.output.includes(file)) pass(label);
    else fail(`${label} (exit ${result.code})`);
  } catch (error) {
    fail(`${label}: ${error.message}`);
  }
}
