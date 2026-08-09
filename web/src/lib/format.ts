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

const FIELD_KEYS: Record<string, string> = {
  date: "Date",
  fecha: "Date",
  url: "URL",
  archetype: "Archetype",
  arquetipo: "Archetype",
  score: "Score",
  legitimacy: "Legitimacy",
  legitimidad: "Legitimacy",
  pdf: "PDF",
};

/**
 * Tolerant report parser (per maintainer: adapt the render, don't migrate the
 * old data). Extracts the bold key/value header fields (Date/URL/Archetype/
 * Score/Legitimacy/PDF) when present and returns the body without the header
 * block. Degrades gracefully on legacy reports that lack some fields.
 */
export function parseReport(md: string): ReportMeta {
  const lines = md.split("\n");
  // Header runs until the first `---` or the first `## ` section.
  let cut = lines.findIndex((l, i) => i > 0 && (/^\s*-{3,}\s*$/.test(l) || /^##\s/.test(l)));
  if (cut === -1) cut = Math.min(lines.length, 10);

  const headerLines = lines.slice(0, cut);
  let bodyStart = cut;
  if (/^\s*-{3,}\s*$/.test(lines[cut] ?? "")) bodyStart = cut + 1;
  const body = lines.slice(bodyStart).join("\n").trim();

  let title: string | null = null;
  let legitimacy: string | null = null;
  const fields: { label: string; value: string }[] = [];

  for (const l of headerLines) {
    const h = l.match(/^#\s+(.+)/);
    if (h) {
      title = h[1].replace(/^Evaluat?i[oó]n:?\s*/i, "").trim();
      continue;
    }
    const m = l.match(/^\s*\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) continue;
    const label = FIELD_KEYS[m[1].trim().toLowerCase()];
    const value = m[2].trim();
    if (!label || !value) continue;
    if (label === "Legitimacy") legitimacy = value;
    fields.push({ label, value });
  }

  return { title, fields, legitimacy, body: body || md };
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

function parseYamlScalar(raw: string): string | number | boolean | null {
  const s = raw.trim();
  if (!s || s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
  const quoted = s.match(/^["'](.*)["']$/);
  return quoted ? quoted[1] : s;
}

function parseInlineMap(raw: string): Record<string, unknown> {
  const inner = raw.replace(/^\{|\}$/g, "").trim();
  if (!inner) return {};
  const out: Record<string, unknown> = {};
  for (const part of inner.split(",")) {
    const m = part.match(/^([a-z_]+)\s*:\s*(.+)$/i);
    if (m) out[m[1].trim()] = parseYamlScalar(m[2]);
  }
  return out;
}

/** Tolerant Machine Summary YAML parser — degrades on older reports. */
export function parseMachineSummary(md: string): MachineSummary | null {
  const fenceMatch = md.match(/##\s*Machine Summary\s*\n+```(?:yaml|yml|json)?\s*\n([\s\S]*?)\n```/i);
  if (!fenceMatch) return null;
  const lines = fenceMatch[1].split("\n");
  const out: MachineSummary = {};
  let currentList: string[] | null = null;
  let currentListKey: keyof MachineSummary | null = null;
  let nestedKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItem = trimmed.match(/^-\s+(.+)$/);
    if (listItem && currentList) {
      currentList.push(parseYamlScalar(listItem[1]) as string);
      continue;
    }

    // Nested keys must be indented — an unindented key ends the nested map
    // and falls through to top-level handling below.
    const nested = line.match(/^\s+([a-z_]+):\s*(.+)$/i);
    if (nestedKey && nested) {
      if (!out.risk_summary) out.risk_summary = {};
      out.risk_summary[nested[1]] = String(parseYamlScalar(nested[2]) ?? "");
      continue;
    }

    const kv = trimmed.match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    const key = kv[1] as keyof MachineSummary;
    const rest = kv[2].trim();

    currentList = null;
    currentListKey = null;
    nestedKey = null;

    if (rest === "" || rest === "|" || rest === ">") {
      if (key === "hard_stops" || key === "soft_gaps" || key === "top_strengths" || key === "discard_reasons") {
        currentList = [];
        (out as Record<string, unknown>)[key] = currentList;
        currentListKey = key;
      } else if (key === "risk_summary") {
        nestedKey = "risk_summary";
        out.risk_summary = {};
      }
      continue;
    }

    if (key === "scores" && rest.startsWith("{")) {
      const parsed = parseInlineMap(rest);
      out.scores = {
        match: typeof parsed.match === "number" ? parsed.match : undefined,
        north_star: typeof parsed.north_star === "number" ? parsed.north_star : undefined,
        comp: typeof parsed.comp === "number" ? parsed.comp : undefined,
        culture: typeof parsed.culture === "number" ? parsed.culture : undefined,
        red_flags: typeof parsed.red_flags === "number" ? parsed.red_flags : undefined,
        global: typeof parsed.global === "number" ? parsed.global : undefined,
      };
      continue;
    }

    if (key === "hard_stops" || key === "soft_gaps" || key === "top_strengths" || key === "discard_reasons") {
      out[key] = [String(parseYamlScalar(rest) ?? "")];
      continue;
    }

    const val = parseYamlScalar(rest);
    if (key === "score" && typeof val === "number") out.score = val;
    else if (key === "company_confidential") out.company_confidential = val === true;
    else if (key === "final_decision") out.final_decision = String(val ?? "");
    else if (key === "legitimacy_tier") out.legitimacy_tier = String(val ?? "");
    else if (key === "next_action") out.next_action = String(val ?? "");
    else if (key === "risk_level") out.risk_level = String(val ?? "");
    else if (key === "confidence") out.confidence = String(val ?? "");
    else if (key === "archetype") out.archetype = String(val ?? "");
    else if (key === "advertised_comp") out.advertised_comp = String(val ?? "");
    else if (key === "via") out.via = String(val ?? "");
    else if (key === "company") out.company = String(val ?? "");
    else if (key === "role") out.role = String(val ?? "");
  }

  return Object.keys(out).length ? out : null;
}

/** Remove Machine Summary block from prose body (rendered natively in UI). */
export function stripMachineSummary(body: string): string {
  return body
    .replace(/##\s*Machine Summary\s*\n+```(?:yaml|yml|json)?\s*\n[\s\S]*?\n```\s*/i, "")
    .trim();
}
