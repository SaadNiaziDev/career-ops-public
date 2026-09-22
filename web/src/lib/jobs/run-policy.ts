import { normalizeVacancyUrl } from "../vacancy-identity.ts";

export type RunState = "queued" | "running" | "needs-attention" | "completed" | "cancelled" | "interrupted";

export function intentKey(kind: string, input: string): string {
  return `${kind.trim().toLowerCase()}:${canonicalTarget(input)}`;
}

export function isActiveState(state: RunState): boolean {
  return state === "queued" || state === "running";
}

export function stateFromLegacyStatus(status?: string): RunState {
  if (status === "done") return "completed";
  if (status === "error") return "needs-attention";
  return "running";
}

export function isStuck(state: RunState, lastActivityAt: number, now: number, thresholdMs = 90_000): boolean {
  return isActiveState(state) && now - lastActivityAt >= thresholdMs;
}

export function artifactChanged(
  before: Map<string, string>,
  after: Map<string, string>,
  expectedFile?: string,
): boolean {
  if (expectedFile) return after.has(expectedFile) && before.get(expectedFile) !== after.get(expectedFile);
  for (const [file, signature] of after) if (before.get(file) !== signature) return true;
  return false;
}

export function fatalExitMessage(input: {
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  cancelled: boolean;
  emittedOutput: boolean;
  stderr: string;
}): string | null {
  if (input.cancelled) return null;
  if (input.timedOut) return "The worker timed out before it could finish. Retry to continue safely.";
  if (input.code !== 0) {
    if (/auth|login|sign[ -]?in|credential|api[ -]?key|unauthorized|not authenticated/i.test(input.stderr)) {
      return "The CLI needs authentication. Sign in from Config, then retry.";
    }
    if (/quota|rate.?limit|too many requests/i.test(input.stderr)) {
      return "The AI provider rate limit or quota stopped this run. Wait or adjust the provider, then retry.";
    }
    if (/enoent|command not found|not found/i.test(input.stderr)) {
      return "A required CLI command or project file is missing. Check Config and the career-ops installation.";
    }
    return `The CLI stopped${input.signal ? ` (${input.signal})` : ` with exit code ${input.code}`} before finishing.`;
  }
  if (!input.emittedOutput) return "The CLI finished without producing a result. Check its authentication, then retry.";
  return null;
}

function canonicalTarget(input: string): string {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) return normalizeVacancyUrl(value) ?? value.toLowerCase().replace(/\/+$/, "");
  if (/^\d+$/.test(value)) return String(parseInt(value, 10));
  return value.replace(/\s+/g, " ").toLowerCase();
}
