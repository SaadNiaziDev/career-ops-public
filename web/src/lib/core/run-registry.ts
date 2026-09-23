let seq = 0;
const vacancyRuns = new Map<string, number>();
const activeRuns = new Map<string, { intentKey: string; cancel?: () => void }>();
const runsByIntent = new Map<string, string>();

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
