"use client";

import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { useJobs } from "@/components/jobs/job-store";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { humanizeJobKind, jobDestinationHref, resolveReportNum } from "@/components/jobs/job-utils";
import { isActiveState, type RunState } from "@/lib/jobs/run-policy";

function StatusIcon({ state }: { state: RunState }) {
  if (isActiveState(state)) {
    return <MaterialSymbol name="progress_activity" size={22} className="animate-spin text-[var(--md-sys-color-primary)]" />;
  }
  if (state === "needs-attention" || state === "interrupted") {
    return <MaterialSymbol name="warning" size={22} className="text-[var(--md-sys-color-error)]" />;
  }
  if (state === "cancelled") return <MaterialSymbol name="cancel" size={22} className="text-[var(--md-sys-color-outline)]" />;
  return <MaterialSymbol name="check_circle" size={22} className="text-[var(--md-sys-color-tertiary)]" />;
}

export default function JobsHistory() {
  const { jobs, clearFinished } = useJobs();
  const { applications } = usePipeline();
  const grouped = Array.from(
    jobs.reduce((groups, job) => {
      const key = job.intentKey || job.id;
      groups.set(key, [...(groups.get(key) ?? []), job]);
      return groups;
    }, new Map<string, typeof jobs>()).values(),
  );

  return (
    <PageShell width="default">
      <DossierStack>
        <DossierPageHeader
          title="Activity"
          description={
            <>
              Task outcomes and recovery. <span className="tabular-nums">{grouped.length}</span> tasks.
            </>
          }
          extra={
            jobs.some((j) => !isActiveState(j.state)) ? (
              <button type="button" onClick={clearFinished} className="md3-btn-outlined">
                <MaterialSymbol name="delete" size={18} />
                Clear finished
              </button>
            ) : undefined
          }
        />

        {jobs.length === 0 ? (
          <div className="rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] px-6 py-16 text-center md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
            No activity yet. Evaluate a posting to see its progress and result here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)]">
            {grouped.map((attempts) => {
              const j = attempts[0];
              const reportN = resolveReportNum(j, applications);
              const dest = jobDestinationHref(j, applications);
              const stateLabel =
                j.state === "needs-attention" || j.state === "interrupted" ? "Needs attention"
                  : j.state === "running" ? "Working"
                    : j.state === "queued" ? "Queued"
                      : j.state === "completed" ? "Completed" : "Cancelled";
              return (
                <div
                  key={j.intentKey || j.id}
                  className="border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3 last:border-b-0"
                >
                  <div className="flex min-h-[56px] items-center gap-4">
                    <StatusIcon state={j.state} />
                    <div className="min-w-0 flex-1">
                      <Link href={dest} className="block truncate md-title-small text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-primary)]">
                        {j.title}
                      </Link>
                      <p className="truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                        {j.result?.summary || (j.state === "needs-attention" || j.state === "interrupted" ? "Open task for recovery options." : j.subtitle || humanizeJobKind(j.kind))}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--md-sys-color-outline)]">
                        {stateLabel} · {humanizeJobKind(j.kind)} · {j.steps.length} updates
                      </p>
                    </div>
                    {j.result?.score != null && (
                      <span className="md3-score-badge">{j.result.score}/5</span>
                    )}
                    {j.state === "completed" && reportN ? (
                      <Link
                        href={`/pipeline/${reportN}`}
                        className="hidden shrink-0 md-label-small text-[var(--md-sys-color-primary)] hover:underline sm:inline"
                      >
                        Report
                      </Link>
                    ) : null}
                  </div>
                  {attempts.length > 1 ? (
                    <details className="ml-10 mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      <summary className="cursor-pointer">{attempts.length - 1} previous {attempts.length === 2 ? "attempt" : "attempts"}</summary>
                      <ul className="mt-2 space-y-1">
                        {attempts.slice(1).map((attempt) => (
                          <li key={attempt.id} className="flex items-center justify-between gap-3">
                            <span>{attempt.state === "completed" ? "Completed" : attempt.state === "cancelled" ? "Cancelled" : "Needs attention"}</span>
                            <Link href={`/jobs/${attempt.id}`} className="text-[var(--md-sys-color-primary)] hover:underline">View attempt</Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </DossierStack>
    </PageShell>
  );
}
