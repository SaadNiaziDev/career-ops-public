export const PIPELINE_STAGES = [
  { key: "EVALUATED", label: "Evaluated", stage: "evaluated" },
  { key: "APPLIED", label: "Applied", stage: "applied" },
  { key: "RESPONDED", label: "Responded", stage: "responded" },
  { key: "INTERVIEW", label: "Interview", stage: "interview" },
  { key: "OFFER", label: "Offer", stage: "offer" },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

/** Exact current state for one tracker row; terminal states are outside this map. */
export function currentPipelineStage(status: string): PipelineStageKey | null {
  return PIPELINE_STAGES.find((stage) => stage.key === status)?.key ?? null;
}

/** Shared current-stage totals for Pipeline tabs and Analytics. */
export function countPipelineStages<T>(rows: readonly T[], statusOf: (row: T) => string): Record<PipelineStageKey, number> {
  const counts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.key, 0])) as Record<PipelineStageKey, number>;
  for (const row of rows) {
    const stage = currentPipelineStage(statusOf(row));
    if (stage) counts[stage] += 1;
  }
  return counts;
}

export function pipelineRoleFamily(title: string): string {
  const role = title.toLowerCase();
  if (/\b(ai|ml|machine learning|artificial intelligence|llm)\b/.test(role)) return "AI / machine learning";
  if (/\b(data|analytics|bi engineer)\b/.test(role)) return "Data";
  if (/\b(product manager|product owner|product lead)\b/.test(role)) return "Product";
  if (/\b(design|ux|ui)\b/.test(role)) return "Design";
  if (/\b(devops|sre|platform|infrastructure|cloud)\b/.test(role)) return "Infrastructure";
  if (/\b(engineer|developer|software|frontend|backend|full.?stack)\b/.test(role)) return "Software engineering";
  return "Other roles";
}

export function pipelinePostingSource(url?: string, via?: string): string {
  try { return new URL(url ?? "").hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return via?.trim().toLowerCase() ?? ""; }
}
