"use client";

import { scoreNum, type DimensionScores } from "@/lib/format";
import { cn } from "@/lib/cn";

const DIMENSIONS: { key: keyof DimensionScores; label: string }[] = [
  { key: "match", label: "Match" },
  { key: "north_star", label: "North Star" },
  { key: "comp", label: "Comp" },
  { key: "culture", label: "Culture" },
  { key: "red_flags", label: "Red flags" },
  { key: "global", label: "Global" },
];

function barTone(value: number, key: keyof DimensionScores): string {
  if (key === "red_flags") {
    if (value <= -0.5) return "bg-red-500";
    if (value < 0) return "bg-amber-500";
    return "bg-emerald-500";
  }
  if (value >= 4.2) return "bg-emerald-500";
  if (value >= 3.8) return "bg-amber-500";
  if (value >= 3.0) return "bg-[var(--md-sys-color-primary)]";
  return "bg-red-500";
}

function barWidth(value: number, key: keyof DimensionScores): number {
  if (key === "red_flags") {
    const n = Math.max(-2, Math.min(0, value));
    return Math.round(((n + 2) / 2) * 100);
  }
  return Math.round((Math.max(0, Math.min(5, value)) / 5) * 100);
}

export function DimensionChart({ scores, globalScore }: { scores?: DimensionScores; globalScore?: string }) {
  const hasStructured = scores && DIMENSIONS.some((d) => typeof scores[d.key] === "number");

  if (!hasStructured) {
    const n = scoreNum(globalScore ?? "");
    if (Number.isNaN(n)) return null;
    return (
      <section className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--md-sys-color-outline)]">Fit score</p>
        <div className="relative h-2 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-highest)]">
          <div
            className="h-full rounded-full bg-[var(--md-sys-color-primary)]"
            style={{ width: `${(n / 5) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">Global {n.toFixed(1)}/5 — dimension breakdown available on newer reports</p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--md-sys-color-outline)]">Dimension scores</p>
      <div className="space-y-2.5">
        {DIMENSIONS.map((d) => {
          const val = scores?.[d.key];
          if (typeof val !== "number") return null;
          return (
            <div key={d.key} className="grid grid-cols-[88px_1fr_36px] items-center gap-2">
              <span className="truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">{d.label}</span>
              <div className="relative h-2 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-highest)]">
                <div
                  className={cn("h-full rounded-full transition-[width]", barTone(val, d.key))}
                  style={{ width: `${barWidth(val, d.key)}%` }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-[var(--md-sys-color-on-surface)]">
                {val.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
