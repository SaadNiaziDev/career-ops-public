"use client";

import { legitimacyTone, scoreNum, scoreTone, type MachineSummary } from "@/lib/format";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

const DECISION_TONE: Record<string, string> = {
  apply: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  consider: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  skip: "bg-red-500/15 text-red-700 dark:text-red-400",
  research: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

function decisionTone(decision: string): string {
  const d = decision.toLowerCase();
  if (d.includes("apply")) return DECISION_TONE.apply;
  if (d.includes("skip")) return DECISION_TONE.skip;
  if (d.includes("research")) return DECISION_TONE.research;
  return DECISION_TONE.consider;
}

function Chip({ label, tone }: { label: string; tone: "stop" | "gap" | "strength" }) {
  const cls =
    tone === "stop"
      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
      : tone === "gap"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400";
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs", cls)}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function VerdictCard({
  summary,
  score,
  legitimacy,
}: {
  summary: MachineSummary;
  score?: string;
  legitimacy?: string | null;
}) {
  const displayScore = summary.score ?? scoreNum(score ?? "");
  const scoreStr = typeof displayScore === "number" && !Number.isNaN(displayScore) ? displayScore.toFixed(1) : score;
  const tone = scoreStr ? scoreTone(String(scoreStr)) : "muted";
  const leg = summary.legitimacy_tier || legitimacy || "";
  const legTone = leg ? legitimacyTone(leg) : "muted";

  return (
    <section className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          {summary.final_decision && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                decisionTone(summary.final_decision),
              )}
            >
              <MaterialSymbol name="gavel" size={16} />
              {summary.final_decision}
            </span>
          )}
          {summary.next_action && (
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{summary.next_action}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {scoreStr && (
            <div className="text-right">
              <span className="block text-4xl font-bold tabular-nums text-[var(--md-sys-color-primary)]">{scoreStr}</span>
              <span className="text-xs text-[var(--md-sys-color-outline)]">/5 fit</span>
            </div>
          )}
          {leg && (
            <span
              className={cn(
                "rounded-[var(--md-sys-shape-corner-small)] px-2 py-1 text-xs font-medium",
                legTone === "good" && "bg-emerald-500/15 text-emerald-700",
                legTone === "warn" && "bg-amber-500/15 text-amber-700",
                legTone === "bad" && "bg-red-500/15 text-red-700",
                legTone === "muted" && "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]",
              )}
            >
              {leg}
            </span>
          )}
          {summary.risk_level && (
            <span className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-1 text-xs font-medium text-[var(--md-sys-color-on-tertiary-container)]">
              Risk: {summary.risk_level}
            </span>
          )}
        </div>
      </div>

      {(summary.hard_stops?.length || summary.soft_gaps?.length || summary.top_strengths?.length) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {summary.hard_stops && summary.hard_stops.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-600">Hard stops</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.hard_stops.map((item) => (
                  <Chip key={`stop-${item}`} label={item} tone="stop" />
                ))}
              </div>
            </div>
          )}
          {summary.soft_gaps && summary.soft_gaps.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">Soft gaps</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.soft_gaps.map((item) => (
                  <Chip key={`gap-${item}`} label={item} tone="gap" />
                ))}
              </div>
            </div>
          )}
          {summary.top_strengths && summary.top_strengths.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.top_strengths.map((item) => (
                  <Chip key={`str-${item}`} label={item} tone="strength" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
