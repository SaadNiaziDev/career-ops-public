"use client";

import { legitimacyTone, scoreNum, scoreTone, type MachineSummary } from "@/lib/format";
import { MaterialSymbol } from "@/components/material-symbol";
import { decisionTone, TONE_CHIP, TONE_OUTLINE, TONE_TEXT, type Tone } from "@/lib/tone";
import { cn } from "@/lib/cn";

function Chip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-2xl border px-2.5 py-1 text-xs",
        TONE_OUTLINE[tone],
      )}
    >
      <span className="line-clamp-2 whitespace-normal leading-snug">{label}</span>
    </span>
  );
}

function ChipColumn({ title, tone, items }: { title: string; tone: Tone; items: string[] }) {
  return (
    <div>
      <p className={cn("mb-1.5 text-[11px] font-semibold uppercase tracking-wide", TONE_TEXT[tone])}>{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip key={`${title}-${item}`} label={item} tone={tone} />
        ))}
      </div>
    </div>
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
  const facts = [
    summary.confidence ? { label: "Confidence", value: summary.confidence } : null,
    summary.advertised_comp !== undefined
      ? { label: "Comp from posting", value: summary.advertised_comp || "Not stated" }
      : null,
    summary.via ? { label: "Source", value: summary.via } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <section className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          {summary.final_decision && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                TONE_CHIP[decisionTone(summary.final_decision)],
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
              <span
                className={cn(
                  "block font-mono text-[34px] font-semibold leading-none tabular-nums",
                  TONE_TEXT[tone],
                )}
              >
                {scoreStr}
              </span>
              <span className="text-xs text-[var(--md-sys-color-outline)]">/5 fit</span>
            </div>
          )}
          {leg && (
            <span
              className={cn(
                "rounded-[var(--md-sys-shape-corner-small)] px-2 py-1 text-xs font-medium",
                TONE_CHIP[legTone],
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
            <ChipColumn title="Hard stops" tone="bad" items={summary.hard_stops} />
          )}
          {summary.soft_gaps && summary.soft_gaps.length > 0 && (
            <ChipColumn title="Soft gaps" tone="warn" items={summary.soft_gaps} />
          )}
          {summary.top_strengths && summary.top_strengths.length > 0 && (
            <ChipColumn title="Strengths" tone="good" items={summary.top_strengths} />
          )}
        </div>
      )}
      {facts.length > 0 && (
        <div className="mt-4 grid gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--md-sys-color-outline)]">{fact.label}</p>
              <p className="mt-1 break-words text-sm text-[var(--md-sys-color-on-surface-variant)]">{fact.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
