#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { writeFileAtomic } from './tracker-utils.mjs';

export const APPLICATION_ANSWERS_HEADING = '## Application Answers';

const VALID_STATES = new Set(['draft', 'filled', 'submitted']);
const SENSITIVE_FIELD = /password|passcode|captcha|cookie|auth(?:entication|orization)?\s*token|access\s*token|secret|one[- ]?time\s*(?:code|password)|\botp\b/i;

function inline(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function markdownInline(value) {
  return inline(value).replace(/([\\`*_[\]<>])/g, '\\$1');
}

function pick(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (Array.isArray(value)) {
      if (value.length > 0) return value;
      continue;
    }
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeState(state) {
  const normalized = inline(state || 'filled').toLowerCase();
  if (!VALID_STATES.has(normalized)) {
    throw new Error(`Application answer state must be one of: ${[...VALID_STATES].join(', ')}`);
  }
  return normalized;
}

function normalizeDate(date) {
  return inline(date || new Date().toISOString().slice(0, 10));
}

function normalizeTimestamp(value) {
  const timestamp = inline(value);
  return timestamp && !Number.isNaN(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : '';
}

function quoteBlock(value) {
  const text = (Array.isArray(value) ? value.map(inline).filter(Boolean).join(', ') : String(value ?? ''))
    .replace(/\r\n/g, '\n').trim();
  if (!text) return '> Not recorded.';
  return text.split('\n').map((line) => `> ${line}`).join('\n');
}

function fileLines(entries) {
  if (entries.length === 0) return ['- None captured.'];

  return entries.map((entry, index) => {
    const label = markdownInline(pick(entry, ['field', 'name', 'label', 'type'])) || `File ${index + 1}`;
    const file = markdownInline(pick(entry, ['path', 'file', 'filename', 'url'])) || 'Not recorded';
    const version = markdownInline(pick(entry, ['version', 'variant']));
    const hash = markdownInline(pick(entry, ['hash', 'sha256']));
    const details = [version, hash ? `sha256:${hash}` : ''].filter(Boolean).join(', ');
    return `${index + 1}. **${label}:** ${file}${details ? ` (${details})` : ''}`;
  });
}

function normalizedFields(snapshot) {
  const fields = list(snapshot.fields).filter((field) => {
    const label = inline(pick(field, ['label', 'field', 'question', 'prompt']));
    const type = inline(field?.type);
    return !SENSITIVE_FIELD.test(`${label} ${type}`);
  });
  if (fields.length > 0) return fields;
  return [
    ...list(snapshot.freeText ?? snapshot.freeTextAnswers ?? snapshot.answers).map((field) => ({ ...field, type: 'textarea' })),
    ...list(snapshot.selections ?? snapshot.selectedOptions).map((field) => ({ ...field, type: field.type || 'select' })),
    ...list(snapshot.fieldValues ?? snapshot.otherFields).map((field) => ({ ...field, type: field.type || 'text' })),
  ].filter((field) => !SENSITIVE_FIELD.test(`${inline(pick(field, ['label', 'field', 'question', 'prompt']))} ${inline(field?.type)}`));
}

function fieldLines(entries) {
  if (entries.length === 0) return ['- None captured.'];
  return entries.flatMap((entry, index) => {
    const label = markdownInline(pick(entry, ['label', 'field', 'question', 'prompt'])) || `Field ${index + 1}`;
    const type = markdownInline(entry?.type || 'text');
    const source = markdownInline(entry?.source || 'user');
    const value = pick(entry, ['value', 'answer', 'response', 'selection', 'selected', 'text']);
    return [`${index + 1}. **${label}** — ${type}; source: ${source}`, '', quoteBlock(value), ''];
  }).slice(0, -1);
}

export function normalizeApplicationAnswersSnapshot(snapshot = {}) {
  return {
    date: normalizeDate(snapshot.date),
    state: normalizeState(snapshot.state),
    vacancyUrl: inline(snapshot.vacancyUrl ?? snapshot.url),
    atsVendor: inline(snapshot.atsVendor ?? snapshot.vendor),
    filledAt: normalizeTimestamp(snapshot.filledAt),
    submittedAt: normalizeTimestamp(snapshot.submittedAt),
    fields: normalizedFields(snapshot),
    files: list(snapshot.files ?? snapshot.uploads ?? snapshot.filesUsed),
  };
}

export function formatApplicationAnswersSection(snapshot = {}) {
  const normalized = normalizeApplicationAnswersSnapshot(snapshot);
  const lines = [
    APPLICATION_ANSWERS_HEADING,
    '',
    `**Date:** ${normalized.date}`,
    `**State:** ${normalized.state}`,
    `**Vacancy URL:** ${normalized.vacancyUrl || 'Not recorded'}`,
    `**ATS/vendor:** ${normalized.atsVendor || 'Unknown'}`,
    `**Filled at:** ${normalized.filledAt || 'Not yet filled'}`,
    `**Submitted at:** ${normalized.submittedAt || 'Not submitted'}`,
    '',
    '### Exact field values',
    '',
    ...fieldLines(normalized.fields),
    '',
    '### Files used',
    '',
    ...fileLines(normalized.files),
    '',
    '```application-answers-json',
    JSON.stringify(normalized),
    '```',
  ];

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function upsertApplicationAnswersSection(reportText, snapshot = {}) {
  const report = String(reportText ?? '').replace(/\r\n/g, '\n');
  let section = formatApplicationAnswersSection(snapshot).trimEnd();
  const heading = /^## Application Answers\s*$/m.exec(report);

  if (!heading) {
    return `${report.trimEnd()}\n\n${section}\n`;
  }

  const start = heading.index;
  const afterHeading = start + heading[0].length;
  const nextHeading = /^## .+$/m.exec(report.slice(afterHeading));
  const end = nextHeading ? afterHeading + nextHeading.index : report.length;
  const previous = report.slice(start, end).trim();
  const wasSubmitted = /^\*\*State:\*\*\s*submitted\s*$/mi.test(previous);
  const previousHistory = previous.match(/^### Previous submitted snapshot[\s\S]*$/m)?.[0];
  if (wasSubmitted && previous !== section && !section.includes(previous)) {
    section += `\n\n### Previous submitted snapshot\n\n${previous.replace(/^## Application Answers\s*$/m, '#### Submitted version')}`;
  } else if (previousHistory && !section.includes(previousHistory)) {
    section += `\n\n${previousHistory}`;
  }
  const before = report.slice(0, start).trimEnd();
  const after = report.slice(end).trimStart();

  return [before, section, after].filter(Boolean).join('\n\n') + '\n';
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--')) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      args[arg.slice(2)] = value;
      i += 1;
    }
  }
  return args;
}

function usage() {
  return [
    'Usage: node application-answers.mjs --report <report.md> --input <answers.json> [--state draft|filled|submitted] [--date YYYY-MM-DD]',
    '',
    'The input JSON may contain: fields, freeText, selections, fieldValues, files, timestamps, URL, vendor, date, and state.',
  ].join('\n');
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n\n${usage()}`);
    process.exitCode = 1;
    return;
  }
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.report || !args.input) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const inputText = args.input === '-' ? readFileSync(0, 'utf-8') : readFileSync(resolve(args.input), 'utf-8');
  const input = JSON.parse(inputText);
  const snapshot = {
    ...input,
    date: args.date || input.date,
    state: args.state || input.state,
  };
  const reportPath = resolve(args.report);
  const updated = upsertApplicationAnswersSection(readFileSync(reportPath, 'utf-8'), snapshot);
  writeFileAtomic(reportPath, updated);

  const normalized = normalizeApplicationAnswersSnapshot(snapshot);
  console.log(JSON.stringify({ report: reportPath, date: normalized.date, state: normalized.state }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
