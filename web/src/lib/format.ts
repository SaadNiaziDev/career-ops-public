import { parseReportDocument } from "./core/report-document.mjs";
// Pure, node-free helpers shared by server and client components (no fs/path
// imports here — career-ops.ts holds the filesystem reads). Aligned with the
// core: normalize-statuses.mjs (aliases) + the Go TUI dashboard (score/status
// colours = the current state-of-the-art).

// Spanish + legacy aliases → canonical English tokens (normalize-statuses.mjs).
const STATUS_ALIAS: Record<string, string> = {
  evaluada: "EVALUATED",
  evaluado: "EVALUATED",
  condicional: "EVALUATED",
  hold: "EVALUATED",
  evaluar: "EVALUATED",
  verificar: "EVALUATED",
  aplicada: "APPLIED",
  aplicado: "APPLIED",
  enviada: "APPLIED",
  sent: "APPLIED",
  respondida: "RESPONDED",
  respondido: "RESPONDED",
  contestada: "RESPONDED",
  entrevista: "INTERVIEW",
  oferta: "OFFER",
  rechazada: "REJECTED",
  rechazado: "REJECTED",
  descartada: "DISCARDED",
  descartado: "DISCARDED",
  cerrada: "DISCARDED",
  cancelada: "DISCARDED",
  duplicado: "DISCARDED",
  repost: "DISCARDED",
  monitor: "SKIP",
  no_aplicar: "SKIP",
  "no aplicar": "SKIP",
};

export const CANONICAL_STATES = [
  "Evaluated",
  "Applied",
  "Responded",
  "Interview",
  "Offer",
  "Rejected",
  "Discarded",
  "SKIP",
] as const;

export function canonStatus(s: string): string {
  const k = s.trim().toLowerCase();
  if (k === "" || k === "—" || k === "-") return "DISCARDED";
  return STATUS_ALIAS[k] ?? s.toUpperCase();
}

/** Status dot colour — MD3 role mapping per design handoff. */
export function statusDot(status: string): string {
  const c = canonStatus(status);
  if (c.includes("OFFER")) return "bg-[var(--md-sys-color-primary)]";
  if (c.includes("INTERVIEW")) return "bg-[var(--md-sys-color-tertiary)]";
  if (c.includes("APPLIED") || c.includes("RESPONDED")) return "bg-[var(--md-sys-color-secondary)]";
  if (c.includes("REJECTED") || c.includes("SKIP")) return "bg-[var(--md-sys-color-error)]";
  if (c.includes("DISCARDED")) return "bg-[var(--md-sys-color-outline-variant)] opacity-60";
  return "bg-[var(--md-sys-color-outline)]";
}

/** First number in a score string ("4.1/5", "B+", "3.0") → numeric, or NaN. */
export function scoreNum(s: string): number {
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

/** Score → tone, mirroring the Go TUI thresholds (>=4.2 green, >=3.8 yellow,
 *  >=3.0 normal, <3.0 red). */
export function scoreTone(score: string): "good" | "warn" | "bad" | "muted" {
  const num = scoreNum(score);
  if (!Number.isNaN(num)) {
    if (num >= 4.2) return "good";
    if (num >= 3.8) return "warn";
    if (num >= 3.0) return "muted";
    return "bad";
  }
  const g = score.trim().toUpperCase()[0];
  if (g === "A") return "good";
  if (g === "B") return "warn";
  if (g === "C") return "muted";
  if (g === "D" || g === "E" || g === "F") return "bad";
  return "muted";
}

/** Block-G legitimacy tier → tone. */
export function legitimacyTone(l: string): "good" | "warn" | "bad" | "muted" {
  const s = l.toLowerCase();
  if (s.includes("high") || s.includes("confian") || s.includes("legit")) return "good";
  if (s.includes("caution") || s.includes("precau") || s.includes("caut")) return "warn";
  if (s.includes("suspic") || s.includes("sospech") || s.includes("scam") || s.includes("fake")) return "bad";
  return "muted";
}

export type ReportMeta = {
  title: string | null;
  fields: { label: string; value: string }[];
  legitimacy: string | null;
  body: string;
};



/**
 * Tolerant report parser (per maintainer: adapt the render, don't migrate the
 * old data). Extracts the bold key/value header fields (Date/URL/Archetype/
 * Score/Legitimacy/PDF) when present and returns the body without the header
 * block. Degrades gracefully on legacy reports that lack some fields.
 */
export function parseReport(md: string): ReportMeta {
  const parsed = parseReportDocument(md);
  return { title: parsed.title, fields: parsed.fields, legitimacy: parsed.legitimacy, body: parsed.body };
}

export type DimensionScores = {
  match?: number;
  north_star?: number;
  comp?: number;
  culture?: number;
  red_flags?: number;
  global?: number;
};

export type MachineSummary = {
  company?: string;
  role?: string;
  score?: number;
  legitimacy_tier?: string;
  archetype?: string;
  final_decision?: string;
  hard_stops?: string[];
  soft_gaps?: string[];
  top_strengths?: string[];
  risk_level?: string;
  confidence?: string;
  next_action?: string;
  discard_reasons?: string[];
  advertised_comp?: string;
  via?: string;
  company_confidential?: boolean;
  risk_summary?: Record<string, string>;
  scores?: DimensionScores;
};

/** Parse Machine Summary through the shared report document parser. */
export function parseMachineSummary(md: string): MachineSummary | null {
  return parseReportDocument(md).machineSummary as MachineSummary | null;
}

/** Remove Machine Summary block from prose body (rendered natively in UI). */
export function stripMachineSummary(body: string): string {
  return body.replace(/##\s*Machine Summary\s*\n+```(?:yaml|yml|json)?\s*\n[\s\S]*?\n```\s*/i, "").trim();
}
