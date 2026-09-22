// In-memory registry of in-flight runs that WRITE the tracker (kind evaluate/pdf →
// the core runs merge-tracker / updates applications.md). The web is a single local
// Node process, so a module-level set is enough.
//
// Why this exists: `tracker.mjs delete` (#1200) does NOT yet share a file lock with
// merge-tracker (a documented follow-up — merge-tracker isn't import-safe), so a row
// delete must not run while a worker is mid-merge or one of the two writes is lost.
// The delete route serializes against this registry — coarse (the whole run), but
// correct: we never delete while an evaluation is in flight.

let seq = 0;
const writing = new Set<number>();
const vacancyRuns = new Map<string, number>();
const activeRuns = new Map<string, { intentKey: string; cancel?: () => void }>();
const runsByIntent = new Map<string, string>();

/** Mark that a tracker-writing run has started; returns a token to release with. */
export function acquireTrackerWrite(): number {
  const token = ++seq;
  writing.add(token);
  return token;
}

export function releaseTrackerWrite(token: number): void {
  writing.delete(token);
}

/** True while any evaluation/pdf run that mutates applications.md is in flight. */
export function isTrackerWriting(): boolean {
  return writing.size > 0;
}

export function acquireVacancyRun(vacancyId: string): { token: number; existing?: number } {
  const existing = vacancyRuns.get(vacancyId);
  if (existing !== undefined) return { token: existing, existing };
  const token = ++seq;
  vacancyRuns.set(vacancyId, token);
  return { token };
}

export function releaseVacancyRun(vacancyId: string, token: number): void {
  if (vacancyRuns.get(vacancyId) === token) vacancyRuns.delete(vacancyId);
}

export function acquireRun(runId: string, intentKey: string): { accepted: boolean; existingRunId?: string } {
  const existingRunId = runsByIntent.get(intentKey);
  if (existingRunId) return { accepted: false, existingRunId };
  activeRuns.set(runId, { intentKey });
  runsByIntent.set(intentKey, runId);
  return { accepted: true };
}

export function attachRunCancellation(runId: string, cancel: () => void): void {
  const run = activeRuns.get(runId);
  if (run) run.cancel = cancel;
}

export function cancelRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run) return false;
  run.cancel?.();
  return true;
}

export function releaseRun(runId: string): void {
  const run = activeRuns.get(runId);
  if (!run) return;
  activeRuns.delete(runId);
  if (runsByIntent.get(run.intentKey) === runId) runsByIntent.delete(run.intentKey);
}
