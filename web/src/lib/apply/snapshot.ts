import type { ApplyField } from "./extract";

export type AnswerSource = "profile" | "ai" | "user" | "form";
export type SnapshotState = "draft" | "filled" | "submitted";

export type SnapshotField = {
  id?: string;
  label: string;
  value: string;
  type: ApplyField["type"];
  source: AnswerSource;
};

export type ApplicationSnapshot = {
  date?: string;
  state: SnapshotState;
  vacancyUrl: string;
  atsVendor?: string;
  filledAt?: string;
  submittedAt?: string;
  fields: SnapshotField[];
  files?: Array<{ label: string; path: string; version?: string; hash?: string }>;
};

const SENSITIVE_FIELD = /password|passcode|captcha|cookie|auth(?:entication|orization)?\s*token|access\s*token|secret|one[- ]?time\s*(?:code|password)|\botp\b/i;

export function isSensitiveField(field: Pick<SnapshotField, "label" | "type">): boolean {
  return SENSITIVE_FIELD.test(`${field.label} ${field.type}`);
}

export function snapshotFields(
  fields: ApplyField[],
  answers: Record<string, string>,
  sources: Record<string, AnswerSource>,
): SnapshotField[] {
  return fields
    .map((field) => ({
      id: field.id,
      label: field.label || field.nativeName || field.id,
      value: answers[field.id] ?? field.value ?? "",
      type: field.type,
      source: sources[field.id] ?? (answers[field.id] !== undefined ? "user" : "form"),
    }))
    .filter((field) => !isSensitiveField(field));
}

export function parseApplicationSnapshot(report: string): ApplicationSnapshot | null {
  const match = report.match(/```application-answers-json\s*\n([^\n]+)\n```/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]) as ApplicationSnapshot;
    return value && Array.isArray(value.fields) ? value : null;
  } catch {
    return null;
  }
}

export function restoredAnswers(snapshot: ApplicationSnapshot, fields: ApplyField[]) {
  const answers: Record<string, string> = {};
  const sources: Record<string, AnswerSource> = {};
  for (const field of fields) {
    const saved = snapshot.fields.find((item) => item.id === field.id) ??
      snapshot.fields.find((item) => item.label.trim().toLowerCase() === field.label.trim().toLowerCase());
    if (!saved) continue;
    answers[field.id] = saved.value;
    sources[field.id] = saved.source;
  }
  return { answers, sources };
}

export function mergeLiveValues(
  saved: SnapshotField[],
  live: Array<{ id: string; label: string; type: ApplyField["type"]; value: string }>,
): SnapshotField[] {
  const byId = new Map(live.map((field) => [field.id, field]));
  return saved.map((field) => {
    const current = field.id ? byId.get(field.id) : undefined;
    return current ? { ...field, label: current.label, type: current.type, value: current.value, source: "user" } : field;
  });
}

export function detectAtsVendor(url: string): string {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return "Unknown"; }
  const vendors: Array<[RegExp, string]> = [
    [/greenhouse/, "Greenhouse"],
    [/lever\.co$/, "Lever"],
    [/ashbyhq\.com$/, "Ashby"],
    [/workday|myworkdayjobs/, "Workday"],
    [/workable\.com$/, "Workable"],
    [/smartrecruiters/, "SmartRecruiters"],
    [/successfactors/, "SuccessFactors"],
  ];
  return vendors.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}
