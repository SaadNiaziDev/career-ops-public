import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatApplicationAnswersSection,
  normalizeApplicationAnswersSnapshot,
  upsertApplicationAnswersSection,
} from './application-answers.mjs';

test('records exact typed values and provenance while excluding sensitive fields', () => {
  const snapshot = normalizeApplicationAnswersSnapshot({
    state: 'filled',
    vacancyUrl: 'https://example.com/jobs/1',
    fields: [
      { label: 'Salary expectation', value: 'USD 120,000/year', type: 'text', source: 'user' },
      { label: 'Password', value: 'never-store-me', type: 'password', source: 'user' },
    ],
  });
  assert.equal(snapshot.fields.length, 1);
  assert.match(formatApplicationAnswersSection(snapshot), /USD 120,000\/year/);
  assert.doesNotMatch(formatApplicationAnswersSection(snapshot), /never-store-me/);
});

test('keeps the previous submitted version when answers are edited', () => {
  const first = upsertApplicationAnswersSection('# Report\n', {
    state: 'submitted',
    submittedAt: '2026-09-22T10:00:00Z',
    fields: [{ label: 'Salary', value: '$100k', type: 'text', source: 'user' }],
  });
  const edited = upsertApplicationAnswersSection(first, {
    state: 'filled',
    filledAt: '2026-09-22T11:00:00Z',
    fields: [{ label: 'Salary', value: '$110k', type: 'text', source: 'user' }],
  });
  assert.match(edited, /\$110k/);
  assert.match(edited, /Previous submitted snapshot/);
  assert.match(edited, /\$100k/);
});
