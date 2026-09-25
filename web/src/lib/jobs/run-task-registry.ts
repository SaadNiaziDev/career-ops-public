export type RunTaskKind =
  | "evaluate" | "research" | "pdf" | "cover" | "email" | "titles" | "contacto" | "fix-portal"
  | "interview-prep" | "interview-questions" | "interview-plan" | "interview-practice" | "interview-debrief" | "interview-redflag";

export type RunTaskEvidence = { reportChanged?: boolean; pdfVerified?: boolean; writesChanged?: boolean; emittedOutput?: boolean };
export type RunTaskDescriptor = {
  kind: RunTaskKind;
  prompt: (...args: any[]) => string;
  requiredFile: string;
  requiresCv: boolean;
  workerPhase: "fetch" | "local-analysis" | "write";
  fetchPosting: boolean;
  timeoutMs: number;
  completionCheck: "report" | "pdf" | "writes" | "output";
  reportNumber: "new-report" | "input-if-numeric" | "find-by-input" | "none";
  group: "interview" | "standard";
};

type Policy = Omit<RunTaskDescriptor, "kind" | "prompt">;
type PromptFactory = (kind: RunTaskKind, ...args: any[]) => string;

// All /api/run task-specific prerequisites, sandbox phase, deadlines and completion proofs live here.
const POLICIES: Record<RunTaskKind, Policy> = {
  evaluate: { requiredFile: "modes/oferta.md", requiresCv: true, workerPhase: "write", fetchPosting: true, timeoutMs: 720_000, completionCheck: "report", reportNumber: "new-report", group: "standard" },
  research: { requiredFile: "", requiresCv: false, workerPhase: "fetch", fetchPosting: false, timeoutMs: 285_000, completionCheck: "output", reportNumber: "find-by-input", group: "standard" },
  pdf: { requiredFile: "render-cv.mjs", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 720_000, completionCheck: "pdf", reportNumber: "input-if-numeric", group: "standard" },
  cover: { requiredFile: "modes/cover.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 300_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "standard" },
  email: { requiredFile: "modes/email.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 300_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "standard" },
  titles: { requiredFile: "modes/titles.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 300_000, completionCheck: "writes", reportNumber: "find-by-input", group: "standard" },
  contacto: { requiredFile: "modes/contacto.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 360_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "standard" },
  "fix-portal": { requiredFile: "verify-portals.mjs", requiresCv: false, workerPhase: "write", fetchPosting: false, timeoutMs: 285_000, completionCheck: "writes", reportNumber: "find-by-input", group: "standard" },
  "interview-prep": { requiredFile: "modes/interview-prep.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 360_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "interview" },
  "interview-questions": { requiredFile: "modes/interview-prep.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 360_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "interview" },
  "interview-plan": { requiredFile: "modes/interview/plan.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 300_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "interview" },
  "interview-practice": { requiredFile: "modes/interview/practice.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 300_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "interview" },
  "interview-debrief": { requiredFile: "modes/interview/debrief.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 300_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "interview" },
  "interview-redflag": { requiredFile: "modes/interview-redflag.md", requiresCv: true, workerPhase: "write", fetchPosting: false, timeoutMs: 285_000, completionCheck: "writes", reportNumber: "input-if-numeric", group: "interview" },
};

export function getRunTaskPolicy(kind: string): Policy | null {
  return Object.hasOwn(POLICIES, kind) ? POLICIES[kind as RunTaskKind] : null;
}

export function createRunTaskRegistry(promptFactory: PromptFactory): Readonly<Record<RunTaskKind, RunTaskDescriptor>> {
  const entries = Object.entries(POLICIES).map(([key, policy]) => {
    const kind = key as RunTaskKind;
    return [kind, Object.freeze({ kind, ...policy, prompt: (...args: any[]) => promptFactory(kind, ...args) })];
  });
  return Object.freeze(Object.fromEntries(entries) as Record<RunTaskKind, RunTaskDescriptor>);
}

export function getRunTask(registry: Readonly<Record<RunTaskKind, RunTaskDescriptor>>, kind: string): RunTaskDescriptor | null {
  return Object.hasOwn(registry, kind) ? registry[kind as RunTaskKind] : null;
}

export function runTaskKinds(registry: Readonly<Record<RunTaskKind, RunTaskDescriptor>>, group?: RunTaskDescriptor["group"]): RunTaskKind[] {
  return Object.values(registry).filter((task) => !group || task.group === group).map((task) => task.kind);
}

export function completionError(task: RunTaskDescriptor, evidence: RunTaskEvidence): string | null {
  if (task.completionCheck === "report" && !evidence.reportChanged) return "This evaluation didn't save a report, so it's not in your tracker. Full evaluation is verified on Claude Code.";
  if (task.completionCheck === "pdf" && !evidence.pdfVerified) return "The worker finished, but no newly verified CV artifact was recorded. Open the worker log for the failed render step.";
  if (task.completionCheck === "writes" && !evidence.writesChanged) return "The worker finished without changing a file in its authorized write scope.";
  if (task.completionCheck === "output" && !evidence.emittedOutput) return "The worker finished without producing a result.";
  return null;
}
