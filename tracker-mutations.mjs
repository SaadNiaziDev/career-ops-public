/**
 * Import-safe, serialized mutation boundary for applications.md.
 *
 * Writers calculate changes from the latest tracker content while holding the
 * same filesystem lock, then this module owns backup and atomic replacement.
 */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  canonicalizeTrackerPath,
  trackerLockDirFor,
  acquireTrackerLock,
  writeFileAtomic,
  loadCanonicalStates,
  resolveCanonicalState,
  normalizeCompany,
  cell,
  rebuildRow,
} from './tracker-utils.mjs';
import { resolveColumns, parseTrackerRow, extractTrackerReportNumbers } from './tracker-parse.mjs';
import { roleFuzzyMatch } from './role-matcher.mjs';

function mutationError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function lockOptions(trackerPath, overrides = {}) {
  return {
    timeoutMs: overrides.timeoutMs ?? (Number(process.env.CAREER_OPS_TRACKER_LOCK_TIMEOUT_MS) || 60_000),
    retryMs: overrides.retryMs ?? (Number(process.env.CAREER_OPS_TRACKER_LOCK_RETRY_MS) || 75),
    staleMs: overrides.staleMs ?? (Number(process.env.CAREER_OPS_TRACKER_LOCK_STALE_MS) || 10 * 60_000),
    tracker: trackerPath,
  };
}

/** Acquire the canonical cross-process tracker lock for a writer adapter. */
export async function acquireTrackerMutationLock(trackerPath, options = {}) {
  const file = canonicalizeTrackerPath(trackerPath);
  try {
    return await acquireTrackerLock(trackerLockDirFor(file), lockOptions(file, options));
  } catch (error) {
    if (error.code === 'LOCK_TIMEOUT') throw error;
    throw mutationError('lock-error', `Cannot acquire tracker lock: ${error.message}`);
  }
}

/** Persist one complete tracker snapshot, retaining the previous version. */
export function writeTrackerSnapshot(trackerPath, content) {
  const file = canonicalizeTrackerPath(trackerPath);
  try {
    if (existsSync(file)) writeFileAtomic(`${file}.bak`, readFileSync(file, 'utf8'));
    writeFileAtomic(file, content);
  } catch (error) {
    throw mutationError('write-failure', `Cannot write tracker at ${file}: ${error.message}`);
  }
}

/** Normalize batch/legacy status values to the canonical tracker vocabulary. */
export function normalizeBatchStatus(status) {
  const clean = String(status ?? '').replace(/\*\*/g, '').replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();
  const lower = clean.toLowerCase();
  const canonical = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'];
  for (const value of canonical) if (value.toLowerCase() === lower) return value;
  const aliases = {
    evaluada: 'Evaluated', condicional: 'Evaluated', hold: 'Evaluated', evaluar: 'Evaluated', verificar: 'Evaluated',
    aplicado: 'Applied', enviada: 'Applied', aplicada: 'Applied', applied: 'Applied', sent: 'Applied',
    respondido: 'Responded', entrevista: 'Interview', oferta: 'Offer', rechazado: 'Rejected', rechazada: 'Rejected',
    descartado: 'Discarded', descartada: 'Discarded', cerrada: 'Discarded', cancelada: 'Discarded',
    'no aplicar': 'SKIP', no_aplicar: 'SKIP', skip: 'SKIP', monitor: 'SKIP', 'geo blocker': 'SKIP',
  };
  if (aliases[lower]) return aliases[lower];
  if (/^(duplicado|dup|repost)/i.test(lower)) return 'Discarded';
  console.warn(`⚠️  Non-canonical status "${status}" → defaulting to "Evaluated"`);
  return 'Evaluated';
}

/**
 * Run one read/modify/write against the latest tracker snapshot under the
 * cross-process lock. Return `{ content, value }`; unchanged content is not
 * rewritten. The previous tracker is atomically saved to `applications.md.bak`.
 */
export async function mutateTracker(trackerPath, update, options = {}) {
  const file = canonicalizeTrackerPath(trackerPath);
  if (!existsSync(file)) throw mutationError('no-tracker', `No tracker found at ${file}`);

  if (options.dryRun) {
    const before = readFileSync(file, 'utf8');
    const { value } = await update(before, file);
    return value;
  }

  const lock = await acquireTrackerMutationLock(file, options.lock);
  try {
    const before = readFileSync(file, 'utf8');
    const { content, value } = await update(before, file);
    if (typeof content !== 'string') throw new TypeError('Tracker mutation must return string content.');
    if (content !== before) {
      writeTrackerSnapshot(file, content);
    }
    return value;
  } finally {
    lock.release();
  }
}

function findTarget(lines, colmap, selector, role) {
  const rows = lines.flatMap((line, lineIdx) => {
    const row = parseTrackerRow(line, colmap);
    return row ? [{ ...row, lineIdx }] : [];
  });
  let matches;
  if (/^\d+$/.test(String(selector))) {
    const num = Number.parseInt(selector, 10);
    matches = rows.filter((row) => row.num === num);
    if (!matches.length) throw mutationError('not-found', `No tracker row with #${num}`);
  } else {
    const key = normalizeCompany(String(selector));
    if (!key) throw mutationError('usage', `Selector "${selector}" is empty after normalization`);
    matches = rows.filter((row) => normalizeCompany(row.company) === key);
    if (!matches.length) throw mutationError('not-found', `No tracker row with company matching "${selector}"`);
  }
  if (matches.length > 1 && role) {
    const narrowed = matches.filter((row) => roleFuzzyMatch(row.role, role));
    if (narrowed.length === 1) return narrowed[0];
  }
  if (matches.length > 1) {
    const candidates = matches.map(({ num, company, role: rowRole }) => ({ num, company, role: rowRole }));
    const listing = candidates.map((candidate) => `#${candidate.num}\t${candidate.company}\t${candidate.role}`).join('\n');
    throw mutationError('ambiguous', `Selector "${selector}" matches multiple tracker rows — pass --role to disambiguate:\n${listing}`, { candidates });
  }
  return matches[0];
}

/** Update one row's canonical status and optional idempotent note. */
export async function setTrackerStatus({ trackerPath, statesPath, selector, status, role, force = false, note, dryRun = false, lock }) {
  if (!trackerPath || selector == null || !String(selector).trim()) throw mutationError('usage', 'trackerPath and selector are required.');
  const states = loadCanonicalStates(statesPath);
  const newStatus = resolveCanonicalState(status, states);
  if (!newStatus) throw mutationError('invalid-state', `"${status}" is not a canonical state. Valid states: ${states.map((state) => state.label).join(' · ')}`);

  return mutateTracker(trackerPath, (content) => {
    const lines = content.split('\n');
    const colmap = resolveColumns(lines);
    const target = findTarget(lines, colmap, String(selector), role);
    if (/^\d+$/.test(String(selector)) && !force) {
      const mismatch = extractTrackerReportNumbers(target.report).filter((num) => num !== target.num);
      if (mismatch.length) {
        throw mutationError('report-number-mismatch', `Tracker #${target.num} points to report ID(s) ${mismatch.map((num) => `#${num}`).join(', ')}. Use the company selector, repair the Report cell, or re-run with --force.`, { trackerNum: target.num, reportNums: mismatch });
      }
    }

    const parts = lines[target.lineIdx].split('|').map((part) => part.trim());
    while (parts.length <= Math.max(colmap.status, colmap.notes ?? 0)) parts.push('');
    const oldStatus = parts[colmap.status] ?? '';
    parts[colmap.status] = newStatus;
    let noteChanged = false;
    const cleanNote = note == null ? null : cell(note);
    if (cleanNote) {
      if (colmap.notes == null) throw mutationError('no-notes-column', 'Tracker has no Notes column.');
      const existing = parts[colmap.notes] ?? '';
      const hasNote = existing === cleanNote || existing.startsWith(`${cleanNote}; `) || existing.endsWith(`; ${cleanNote}`) || existing.includes(`; ${cleanNote}; `);
      if (!hasNote) {
        parts[colmap.notes] = existing && existing !== '—' && existing !== '-' ? `${existing}; ${cleanNote}` : cleanNote;
        noteChanged = true;
      }
    }
    const changed = oldStatus !== newStatus || noteChanged;
    if (changed) lines[target.lineIdx] = rebuildRow(parts);
    return {
      content: lines.join('\n'),
      value: { changed, num: target.num, company: target.company, role: target.role, oldStatus, status: newStatus, newStatus },
    };
  }, { lock, dryRun });
}

/** Set the PDF indicator for one tracker row. */
export async function setTrackerPdfFlag({ trackerPath, selector, value, lock }) {
  if (!trackerPath || selector == null || !/^\d+$/.test(String(selector))) throw mutationError('usage', 'trackerPath and numeric selector are required.');
  if (value !== '✅' && value !== '❌') throw mutationError('invalid-pdf-flag', 'PDF flag must be ✅ or ❌.');
  return mutateTracker(trackerPath, (content) => {
    const lines = content.split('\n');
    const colmap = resolveColumns(lines);
    if (colmap.pdf == null) throw mutationError('no-pdf-column', 'Tracker has no PDF column.');
    const target = findTarget(lines, colmap, String(selector));
    const parts = lines[target.lineIdx].split('|').map((part) => part.trim());
    const oldValue = parts[colmap.pdf] ?? '';
    parts[colmap.pdf] = value;
    if (oldValue !== value) lines[target.lineIdx] = rebuildRow(parts);
    return { content: lines.join('\n'), value: { changed: oldValue !== value, num: target.num, pdf: value } };
  }, { lock });
}

/** Update the role title for one tracker row. */
export async function setTrackerRole({ trackerPath, selector, role, lock }) {
  if (!trackerPath || selector == null || !/^\d+$/.test(String(selector))) throw mutationError('usage', 'trackerPath and numeric selector are required.');
  const cleanRole = cell(role);
  if (!cleanRole || cleanRole === '—' || cleanRole === '-') throw mutationError('invalid-role', 'A non-empty role title is required.');
  return mutateTracker(trackerPath, (content) => {
    const lines = content.split('\n');
    const colmap = resolveColumns(lines);
    const target = findTarget(lines, colmap, String(selector));
    const parts = lines[target.lineIdx].split('|').map((part) => part.trim());
    const oldRole = parts[colmap.role] ?? '';
    if (oldRole !== cleanRole) {
      parts[colmap.role] = cleanRole;
      lines[target.lineIdx] = rebuildRow(parts);
    }
    return { content: lines.join('\n'), value: { changed: oldRole !== cleanRole, num: target.num, oldRole, role: cleanRole } };
  }, { lock });
}

/** Delete one application row by its unique tracker number. */
export async function deleteTrackerRow({ trackerPath, selector, dryRun = false, lock }) {
  if (!trackerPath || selector == null || !/^\d+$/.test(String(selector))) throw mutationError('usage', 'trackerPath and numeric selector are required.');
  return mutateTracker(trackerPath, (content) => {
    const lines = content.split('\n');
    const colmap = resolveColumns(lines);
    const matching = lines.flatMap((line, lineIdx) => {
      const row = parseTrackerRow(line, colmap);
      const numCell = line.startsWith('|') ? (line.split('|').map((part) => part.trim())[colmap.num] ?? '') : '';
      return row && numCell === String(selector) ? [{ ...row, lineIdx }] : [];
    });
    if (!matching.length) throw mutationError('not-found', `No application numbered ${selector} in ${trackerPath}.`);
    const removedLines = new Set(matching.map((row) => row.lineIdx));
    const kept = lines.filter((_, lineIdx) => !removedLines.has(lineIdx));
    const first = matching[0];
    return { content: kept.join('\n'), value: { removed: true, removedCount: matching.length, num: first.num, company: first.company, role: first.role, report: first.report } };
  }, { lock, dryRun });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  const valueFor = (flag) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  const trackerPath = process.env.CAREER_OPS_TRACKER || 'data/applications.md';
  const operation = command === 'pdf'
    ? setTrackerPdfFlag({ trackerPath, selector: valueFor('--num'), value: valueFor('--value') })
    : command === 'role'
      ? setTrackerRole({ trackerPath, selector: valueFor('--num'), role: valueFor('--value') })
      : Promise.reject(mutationError('usage', 'Usage: node tracker-mutations.mjs pdf --num N --value ✅|❌ | role --num N --value "Role title"'));
  operation.then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exitCode = error.code === 'LOCK_TIMEOUT' ? 4 : 1;
  });
}
