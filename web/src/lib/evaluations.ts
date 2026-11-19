import yaml from "js-yaml";
import { db, tx } from "./db.ts";
import { normalizeVacancyUrl } from "./vacancy-identity.ts";
import type { EvaluationJson } from "./prompts.ts";

const clampScore = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, Math.round(n * 10) / 10)) : undefined;
};
const text = (v: unknown, max = 20_000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => text(x, 300)).filter(Boolean).slice(0, 12) : []);

/** Validate the agent's evaluation JSON; throws with a user-facing message. */
export function validateEvaluation(raw: unknown): EvaluationJson {
  if (!raw || typeof raw !== "object") throw new Error("The evaluation result was empty.");
  const r = raw as Record<string, unknown>;
  const company = text(r.company, 120);
  const role = text(r.role, 200);
  const score = clampScore(r.score ?? (r.scores as Record<string, unknown> | undefined)?.global);
  if (!company || !role) throw new Error("The evaluation did not name the company and role. Paste the job description and retry.");
  if (score === undefined || score < 1) throw new Error("The evaluation came back without a score.");
  const scoresIn = (r.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(["match", "north_star", "comp", "culture", "red_flags", "global"].map((k) => [k, clampScore(scoresIn[k])]).filter(([, v]) => v !== undefined));
  const sectionsIn = (r.sections ?? {}) as Record<string, unknown>;
  const sections = Object.fromEntries(Object.entries(sectionsIn).map(([k, v]) => [k, text(v)]).filter(([, v]) => v));
  return {
    company, role, score,
    location: text(r.location, 160) || undefined,
    via: text(r.via, 120) || null,
    archetype: text(r.archetype, 120) || undefined,
    scores: { ...scores, global: score },
    legitimacy_tier: text(r.legitimacy_tier, 40) || undefined,
    final_decision: text(r.final_decision, 40) || undefined,
    hard_stops: list(r.hard_stops), soft_gaps: list(r.soft_gaps), top_strengths: list(r.top_strengths),
    risk_level: text(r.risk_level, 20) || undefined,
    confidence: text(r.confidence, 20) || undefined,
    next_action: text(r.next_action, 300) || undefined,
    discard_reasons: list(r.discard_reasons),
    advertised_comp: text(r.advertised_comp, 120) || null,
    tldr: text(r.tldr, 400) || undefined,
    sections,
    keywords: list(r.keywords).slice(0, 25),
  };
}

function reportMarkdown(e: EvaluationJson, url: string, today: string, verification: string): string {
  const summary = {
    company: e.company, role: e.role, score: e.score, legitimacy_tier: e.legitimacy_tier ?? null, archetype: e.archetype ?? null,
    final_decision: e.final_decision ?? null, hard_stops: e.hard_stops, soft_gaps: e.soft_gaps, top_strengths: e.top_strengths,
    risk_level: e.risk_level ?? null, confidence: e.confidence ?? null, next_action: e.next_action ?? null,
    discard_reasons: e.discard_reasons, via: e.via ?? null, advertised_comp: e.advertised_comp ?? null, scores: e.scores,
  };
  const s = e.sections ?? {};
  const block = (title: string, body?: string) => `## ${title}\n\n${body?.trim() || "_Not assessed._"}\n`;
  return [
    `# Evaluation: ${e.company} — ${e.role}\n`,
    `**Date:** ${today}`,
    `**URL:** ${url}`,
    `**Via:** ${e.via || "—"}`,
    `**Archetype:** ${e.archetype || "—"}`,
    `**Score:** ${e.score.toFixed(1)}/5`,
    `**Legitimacy:** ${e.legitimacy_tier || "—"}`,
    `**Verification:** ${verification}\n`,
    e.tldr ? `> ${e.tldr}\n` : "",
    "---\n",
    `## Machine Summary\n\n\`\`\`yaml\n${yaml.dump(summary, { lineWidth: 200 }).trim()}\n\`\`\`\n`,
    block("A) Role Summary", s.role_summary),
    block("B) Match with CV", s.cv_match),
    block("C) Level and Strategy", s.level_strategy),
    block("D) Comp and Demand", s.comp_demand),
    block("E) Customization Plan", s.customization),
    block("F) Interview Plan", s.interview_plan),
    block("G) Posting Legitimacy", s.legitimacy),
    block("Risk Summary", s.risks),
    "---\n",
    `## Keywords extracted\n\n${(e.keywords ?? []).join(", ") || "—"}\n`,
  ].filter(Boolean).join("\n");
}

/** Application number already evaluated for this posting URL, if any. */
export function evaluationForUrl(url: string): string | undefined {
  const key = normalizeVacancyUrl(url);
  if (!key) return undefined;
  const rows = db().prepare("SELECT n, url FROM reports WHERE url IS NOT NULL").all() as { n: number; url: string }[];
  const hit = rows.find((r) => normalizeVacancyUrl(r.url) === key);
  if (!hit) return undefined;
  const live = db().prepare("SELECT 1 FROM applications WHERE n = ? AND deleted = 0").get(hit.n);
  return live ? String(hit.n) : undefined;
}

/** Save a validated evaluation as a tracker row + report; returns its number. */
export function saveEvaluation(e: EvaluationJson, url: string, verification: string): string {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return tx(() => {
    const d = db();
    const max = d.prepare("SELECT MAX(m) AS m FROM (SELECT MAX(n) AS m FROM applications UNION ALL SELECT MAX(n) FROM reports)").get() as { m: number | null };
    const n = (max.m ?? 0) + 1;
    const content = reportMarkdown(e, url, today, verification);
    d.prepare("INSERT INTO reports (n, file, content, url, location, src_hash) VALUES (?, ?, ?, ?, ?, NULL)")
      .run(n, `${String(n).padStart(3, "0")}-evaluation.md`, content, url, e.location ?? null);
    const note = [e.final_decision, e.tldr].filter(Boolean).join(" — ").slice(0, 240);
    d.prepare(`INSERT INTO applications (n, date, company, via, role, location, score, status, pdf, report, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Evaluated', '❌', ?, ?, ?)`)
      .run(n, today, e.company, e.via || "", e.role, e.location ?? null, `${e.score.toFixed(1)}/5`, `[${n}]`, note, now);
    const key = normalizeVacancyUrl(url);
    if (key) d.prepare("UPDATE jobs SET done = 1 WHERE key = ? OR url = ?").run(key, url);
    return String(n);
  });
}
