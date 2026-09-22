import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVacancyUrl, vacancyFingerprint, vacancyIdFromUrl } from './vacancy-identity.mjs';

test('normalizes tracking params, fragments, and trailing slashes', () => {
  assert.equal(
    normalizeVacancyUrl('https://www.example.com/jobs/52/?utm_source=linkedin&gh_src=abc#apply'),
    'example.com/jobs/52',
  );
});

test('collapses Greenhouse host variants', () => {
  assert.equal(
    normalizeVacancyUrl('https://job-boards.greenhouse.io/acme/jobs/12345?gh_jid=12345&utm_campaign=x'),
    'boards.greenhouse.io/acme/jobs/12345',
  );
  assert.equal(
    normalizeVacancyUrl('https://boards.greenhouse.io/acme/jobs/12345'),
    'boards.greenhouse.io/acme/jobs/12345',
  );
});

test('collapses ATS application suffixes', () => {
  assert.equal(
    normalizeVacancyUrl('https://jobs.ashbyhq.com/Acme/abc-123/application'),
    'jobs.ashbyhq.com/acme/abc-123',
  );
  assert.equal(
    normalizeVacancyUrl('https://apply.workable.com/acme/j/ABCDEF1234/apply/'),
    'apply.workable.com/acme/j/abcdef1234',
  );
});

test('builds stable vacancy ids and fallback fingerprints', () => {
  assert.equal(vacancyIdFromUrl('https://example.com/jobs/52/'), 'url:example.com/jobs/52');
  assert.equal(vacancyFingerprint({ company: 'Bear Plex!', role: 'Senior Full-Stack Engineer' }), 'fingerprint:bear plex|senior full stack engineer');
});
