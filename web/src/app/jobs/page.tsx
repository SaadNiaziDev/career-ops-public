"use client";

import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { useJobs } from "@/components/jobs/job-store";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";

function StatusIcon({ status }: { status: "running" | "done" | "error" }) {
  if (status === "running") {
    return <MaterialSymbol name="progress_activity" size={22} className="animate-spin text-[var(--md-sys-color-primary)]" />;
  }
  if (status === "error") {
    return <MaterialSymbol name="warning" size={22} className="text-[var(--md-sys-color-error)]" />;
  }
  return <MaterialSymbol name="check_circle" size={22} className="text-[var(--md-sys-color-tertiary)]" />;
}

export default function JobsHistory() {
  const { jobs, clearFinished } = useJobs();

  return (
    <PageShell width="default">
      <DossierStack>
        <DossierPageHeader
          title="Workers"
          description={
            <>
              Every evaluation you ran — a persistent log. <span className="tabular-nums">{jobs.length}</span> total.
            </>
          }
          extra={
            jobs.some((j) => j.status !== "running") ? (
              <button type="button" onClick={clearFinished} className="md3-btn-outlined">
                <MaterialSymbol name="delete" size={18} />
                Clear finished
              </button>
            ) : undefined
          }
        />

        {jobs.length === 0 ? (
          <div className="rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] px-6 py-16 text-center md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
            No workers yet. Hit <strong className="text-[var(--md-sys-color-on-surface)]">Evaluate</strong> on an inbox posting to spin one up.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)]">
            {jobs.map((j) => {
              return (
                <div
                  key={j.id}
                  className="flex min-h-[76px] items-center gap-4 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3 last:border-b-0"
                >
                  <StatusIcon status={j.status} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${j.id}`} className="block truncate md-title-small text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-primary)]">
                      {j.title}
                    </Link>
                    <p className="truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                      {j.result?.summary || j.subtitle}
                    </p>
                  </div>
                  {j.result?.score != null && (
                    <span className="md3-score-badge">{j.result.score}/5</span>
                  )}
                  <span className="hidden capitalize md-body-small text-[var(--md-sys-color-outline)] sm:inline">{j.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </DossierStack>
    </PageShell>
  );
}
