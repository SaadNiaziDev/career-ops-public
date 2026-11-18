// Client-safe Apply-kit model (no fs / playwright imports). The kit is everything
// one tracker row needs before the human submits: tailored CV, drafted form
// answers, a cover letter when the form asks for one, the apply URL, and the
// final "I submitted it" → status Applied. Server assembly lives in kit-server.ts.
import type { SnapshotField, SnapshotState } from "./snapshot";

export type CoverNeed = "required" | "optional" | "none" | "unknown";
export type StepState = "done" | "running" | "todo" | "blocked" | "skipped";

export type ProfileFacts = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  salary?: string;
  visa?: string;
  start?: string;
  relocation?: string;
};

export type KitApp = {
  n: string;
  reportNum: string;
  company: string;
  role: string;
  score: number;
  status: string;
  date: string;
  url?: string;
  location?: string;
};

export type ApplyKit = {
  submissionRecorded?: boolean;
  app: KitApp;
  cv: { ready: boolean; file?: string; date?: string; href?: string };
  cover: { ready: boolean; updatedAt?: number; need: CoverNeed };
  answers: { state: SnapshotState | null; vacancyUrl?: string; fields: SnapshotField[]; answered: number; total: number; flagged: number };
  profile: ProfileFacts;
};

export type QueueItem = {
  app: KitApp;
  cvReady: boolean;
  coverReady: boolean;
  coverNeed: CoverNeed;
  answersState: SnapshotState | null;
  answered: number;
  total: number;
};

/** Categories of questions the AI must not answer for the user. */
export type SensitiveKind = "salary" | "visa" | "start" | "relocation" | "demographic" | "legal";

const KIND_RX: Array<[SensitiveKind, RegExp]> = [
  ["salary", /salary|compensation|pay (expectation|range)|expected (pay|ctc|package)|\bctc\b|desired pay|rate expectation|remuneration/i],
  ["visa", /visa|sponsor|work(ing)? (authori[sz]ation|permit)|right to work|legally (eligible|authori[sz]ed)|citizenship|immigration/i],
  ["start", /start date|earliest start|notice period|available to start|availability|when can you (start|join)|joining date/i],
  ["relocation", /relocat/i],
  ["demographic", /gender|pronoun|race|ethnic|veteran|disabilit|sexual orientation|hispanic|latino/i],
  ["legal", /criminal|background check|conviction|non-?compete|related to any (current )?employee/i],
];

export function sensitiveKind(label: string): SensitiveKind | null {
  for (const [kind, rx] of KIND_RX) if (rx.test(label)) return kind;
  return null;
}

export const SENSITIVE_LABEL: Record<SensitiveKind, string> = {
  salary: "Salary",
  visa: "Work authorization",
  start: "Start date",
  relocation: "Relocation",
  demographic: "Voluntary / demographic",
  legal: "Legal",
};

/** A profile value worth suggesting, or undefined for empty / placeholder text. */
export function usable(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  if (!text || /^(not specified|tbd|n\/a|unknown|none)\b/i.test(text) || /confirm with candidate/i.test(text)) return undefined;
  return text;
}

/** Suggest a profile-backed answer for a sensitive question, if the user stored one. */
export function profileSuggestion(kind: SensitiveKind | null, facts: ProfileFacts): string | undefined {
  if (kind === "salary") return facts.salary;
  if (kind === "visa") return facts.visa;
  if (kind === "start") return facts.start;
  if (kind === "relocation") return facts.relocation;
  return undefined;
}

const COVER_RX = /cover\s*letter|motivation(al)?\s*letter|letter of motivation|anschreiben/i;

/** Does the form ask for a cover letter? "unknown" until its fields were read. */
export function coverNeed(fields: Array<{ label: string; required?: boolean }>, known: boolean): CoverNeed {
  if (!known) return "unknown";
  const hit = fields.find((f) => COVER_RX.test(f.label));
  if (!hit) return "none";
  return hit.required ? "required" : "optional";
}

export function isCoverField(label: string): boolean {
  return COVER_RX.test(label);
}

/** A field the user still has to look at: a sensitive kind with no value yet, or any empty text answer. */
export function needsInput(field: Pick<SnapshotField, "label" | "value" | "type">): boolean {
  if (field.type === "file") return false;
  const kind = sensitiveKind(field.label);
  if (!kind) return false;
  // Salary / authorization / start date / relocation are always the user's call,
  // even when a profile value was suggested; the rest only while still empty.
  return ["salary", "visa", "start", "relocation"].includes(kind) || !field.value.trim();
}

export function answerStats(fields: SnapshotField[]): { answered: number; total: number; flagged: number } {
  const usableFields = fields.filter((f) => f.type !== "file");
  return {
    answered: usableFields.filter((f) => f.value.trim()).length,
    total: usableFields.length,
    flagged: usableFields.filter(needsInput).length,
  };
}

export function scoreOf(raw: string): number {
  const m = String(raw ?? "").match(/([0-5](?:\.\d+)?)/);
  return m ? Number.parseFloat(m[1]) : 0;
}

/** Plain text for the clipboard: strip markdown emphasis/headings from a cover draft. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Label: value" lines for "copy all", skipping files and empty answers. */
export function copyAllText(fields: SnapshotField[]): string {
  return fields
    .filter((f) => f.type !== "file" && f.value.trim())
    .map((f) => `${f.label}\n${f.value.trim()}`)
    .join("\n\n");
}

export type KitSteps = { cv: StepState; answers: StepState; cover: StepState; open: StepState; applied: StepState };

/** Static readiness (no live jobs). The UI overlays running jobs on top. */
export function kitSteps(kit: Pick<ApplyKit, "app" | "cv" | "cover" | "answers">): KitSteps {
  const applied = /applied|responded|interview|offer/i.test(kit.app.status);
  const answers: StepState = kit.answers.total > 0 && kit.answers.answered > 0 ? "done" : kit.app.url ? "todo" : "blocked";
  const cover: StepState = kit.cover.ready ? "done" : kit.cover.need === "none" ? "skipped" : "todo";
  return {
    cv: kit.cv.ready ? "done" : "todo",
    answers,
    cover,
    open: kit.app.url ? (applied ? "done" : "todo") : "blocked",
    applied: applied ? "done" : "todo",
  };
}

/** How many prep steps are done out of the ones that apply (for queue meters). */
export function readiness(item: Pick<QueueItem, "cvReady" | "coverReady" | "coverNeed" | "answered">): { done: number; total: number } {
  const coverApplies = item.coverNeed === "required" || item.coverNeed === "optional";
  const total = 2 + (coverApplies ? 1 : 0);
  const done = (item.cvReady ? 1 : 0) + (item.answered > 0 ? 1 : 0) + (coverApplies && item.coverReady ? 1 : 0);
  return { done, total };
}
