"use client";

import type { Job } from "@/components/jobs/job-store";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";
import { fmtElapsed, fmtTokens, humanizeJobKind, humanizeStep, isAuthError, useElapsed } from "@/components/jobs/job-utils";
import { isActiveState, isStuck } from "@/lib/jobs/run-policy";

export const TONE = {
  good: {
    bar: "bg-[var(--md-sys-color-tertiary)]",
    chip: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
    icon: "text-[var(--md-sys-color-tertiary)]",
  },
  warn: {
    bar: "bg-[var(--md-sys-color-primary)]",
    chip: "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]",
    icon: "text-[var(--md-sys-color-primary)]",
  },
  bad: {
    bar: "bg-[var(--md-sys-color-error)]",
    chip: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
    icon: "text-[var(--md-sys-color-error)]",
  },
  muted: {
    bar: "bg-[var(--md-sys-color-outline-variant)]",
    chip: "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]",
    icon: "text-[var(--md-sys-color-outline)]",
  },
} as const;

export function pillTone(j: Job): keyof typeof TONE {
  if (j.state === "needs-attention") return "bad";
  if (j.state === "completed") return j.result?.tone ?? "muted";
  if (j.state === "interrupted") return "warn";
  return "muted";
}

export function WorkerCard({
  job,
  variant = "tray",
  trailing,
}: {
  job: Job;
  variant?: "tray" | "inline";
  trailing?: React.ReactNode;
}) {
  const tone = TONE[pillTone(job)];
  const running = isActiveState(job.state);
  const elapsed = useElapsed(running, job.startedAt);
  const inactiveFor = useElapsed(running, job.lastActivityAt);
  const stuck = isStuck(job.state, job.lastActivityAt, job.lastActivityAt + inactiveFor);
  const rawLast = job.steps[job.steps.length - 1]?.label;
  const last = rawLast ? humanizeStep(rawLast) : undefined;
  const bottom = job.state === "needs-attention" || job.state === "interrupted" || job.state === "cancelled" ? job.error || last : job.state === "completed" && job.result?.summary ? job.result.summary : last;
  const inline = variant === "inline";
  const hasScore = job.result?.score != null;
  const authError = isAuthError(job);
  const tokens = job.state === "completed" ? job.cost?.tokens ?? 0 : 0;

  return (
    <div className={cn(inline && "rounded-xl border border-border bg-surface/60 p-2.5")}>
      <div className="flex items-center gap-2">
        {running ? (
          <MaterialSymbol name="progress_activity" size={14} className="shrink-0 animate-spin text-brand" />
        ) : job.state === "needs-attention" || job.state === "interrupted" ? (
          <MaterialSymbol name="warning" size={14} className={cn("shrink-0", tone.icon)} />
        ) : job.state === "cancelled" ? (
          <MaterialSymbol name="cancel" size={14} className="shrink-0 text-[var(--md-sys-color-outline)]" />
        ) : (
          <MaterialSymbol name="check" size={14} className={cn("shrink-0", tone.icon)} />
        )}
        <span className={cn("truncate font-medium", inline ? "text-sm" : "text-xs")}>{job.title}</span>
        {hasScore && (
          <span
            className={cn(
              "ml-auto shrink-0 rounded px-1 py-0.5 font-semibold tabular-nums",
              inline ? "text-xs" : "text-[10px]",
              tone.chip,
            )}
          >
            {job.result!.score}
          </span>
        )}
        {trailing != null && (
          <span className={cn("shrink-0", hasScore ? "ml-1" : "ml-auto")}>{trailing}</span>
        )}
      </div>
      <div className={cn("mt-1 truncate text-faint", inline ? "text-xs" : "text-[10px]")}>{job.subtitle || humanizeJobKind(job.kind)}</div>
      <div className={cn("mt-1.5 w-full overflow-hidden rounded-full bg-surface-hover", inline ? "h-1.5" : "h-1")}>
        {running ? (
          <div className="job-indeterminate h-full w-full" />
        ) : (
          <div className={cn("h-full w-full rounded-full", tone.bar)} />
        )}
      </div>
      {(bottom || running) && (
        <div className={cn("mt-1 truncate", inline ? "text-xs" : "text-[10px]", running ? "text-faint" : "text-muted")}>
          {running ? `${stuck ? "No new activity" : last ?? "Working"} · ${fmtElapsed(elapsed)}${stuck ? ` · quiet for ${fmtElapsed(inactiveFor)}` : ""}` : bottom}
        </div>
      )}
      {authError && (
        <div className={cn("mt-1 text-[var(--md-sys-color-primary)]", inline ? "text-xs" : "text-[10px]")}>
          Sign your CLI in from Config, then re-run.
        </div>
      )}
      {tokens > 0 && (
        <div className={cn("mt-1 text-faint tabular-nums", inline ? "text-xs" : "text-[10px]")}>
          Technical usage: {fmtTokens(tokens)} model tokens{job.cost?.usd != null ? ` · estimated $${job.cost.usd.toFixed(2)}` : ""}
        </div>
      )}
    </div>
  );
}
