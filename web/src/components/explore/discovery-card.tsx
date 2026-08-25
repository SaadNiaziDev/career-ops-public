"use client";

import { useMemo, useState } from "react";
import { ATS_LABEL, type AtsSource, type DiscoveredOffer } from "@/lib/explore";
import { useJobs } from "@/components/jobs/job-store";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useExplore } from "./explore-provider";
import { jobDestinationHref, resolveReportNum } from "@/components/jobs/job-utils";
import { usePipeline } from "@/components/pipeline/pipeline-provider";

function freshness(postedAt: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return "";
  const days = Math.max(0, Math.round((Date.now() - new Date(postedAt + "T00:00:00Z").getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

function Logo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const letter = (company || "?").trim().charAt(0).toUpperCase();
  if (failed || !company.trim()) {
    return (
      <div className="grid size-10 shrink-0 place-items-center rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-secondary-container)] text-sm font-bold text-[var(--md-sys-color-primary)]">
        {letter}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/logo?company=${encodeURIComponent(company)}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-10 shrink-0 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-high)] object-contain p-1"
    />
  );
}

const WORKER_LABEL: Record<string, string> = { evaluate: "Evaluating…", pdf: "Preparing CV…", research: "Researching…", apply: "Filling…" };

export function DiscoveryCard({ offer, inPipeline, evaluatedN }: { offer: DiscoveredOffer; inPipeline: boolean; evaluatedN?: string }) {
  const { added, adding, addToPipeline } = useExplore();
  const { jobs, startJob } = useJobs();
  const { applications } = usePipeline();

  const job = useMemo(
    () => jobs.filter((j) => j.input === offer.url).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, offer.url],
  );
  const working = job?.status === "running";
  const doneEval = job?.status === "done" && job.kind === "evaluate";
  const reportN = evaluatedN ?? (job ? resolveReportNum(job, applications) : undefined);
  const reportHref = reportN ? `/pipeline/${reportN}` : job ? jobDestinationHref(job, applications) : "/pipeline";
  const statusLabel = WORKER_LABEL[job?.kind ?? ""] ?? "Working…";

  const isAdded = added.has(offer.url) || inPipeline || working || doneEval;
  const isAdding = adding.has(offer.url);
  const unverified = offer.verification === "unconfirmed";
  const fresh = freshness(offer.postedAt) || offer.postedHint || "";

  const evaluate = () => {
    addToPipeline([offer]);
    startJob({ title: `Evaluate · ${offer.company}`, subtitle: offer.title, kind: "evaluate", input: offer.url, page: "/explore" });
  };

  return (
    <article className="flex min-w-0 flex-col rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container-high)] p-4 transition-colors hover:bg-[var(--md-sys-color-surface-container-highest)]">
      <div className="flex items-start gap-3">
        <Logo company={offer.company} />
        <div className="min-w-0 flex-1">
          <a href={offer.url} target="_blank" rel="noopener noreferrer" className="block">
            <h3 className="truncate text-base font-medium text-[var(--md-sys-color-on-surface)]">{offer.title}</h3>
            <p className="mt-0.5 truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">
              {offer.company}
              {offer.location ? ` · ${offer.location}` : ""}
            </p>
          </a>
        </div>
        <a href={offer.url} target="_blank" rel="noopener noreferrer" aria-label="Open posting" className="text-[var(--md-sys-color-outline)]">
          <MaterialSymbol name="open_in_new" size={18} />
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {typeof offer.fitScore === "number" && (
          <span
            className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-primary-container)] px-2 py-0.5 font-semibold tabular-nums text-[var(--md-sys-color-on-primary-container)]"
            title={
              offer.fitSignalReasons?.length
                ? `Why ranked here: ${offer.fitSignalReasons.join(" · ")}`
                : "Heuristic fit from CV overlap, title match, comp band, freshness, and trust"
            }
          >
            Fit {offer.fitScore}
          </span>
        )}
        <span className="rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] px-2 py-0.5 font-medium text-[var(--md-sys-color-outline)]">
          {ATS_LABEL[offer.ats as AtsSource] ?? offer.ats}
        </span>
        {fresh && <span className="font-mono text-[var(--md-sys-color-outline)]">{fresh}</span>}
        {unverified && (
          <span className="inline-flex items-center gap-1 rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 font-medium text-[var(--md-sys-color-on-tertiary-container)]">
            unverified
          </span>
        )}
      </div>

      {offer.why && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--md-sys-color-primary)]">
          <MaterialSymbol name="auto_awesome" size={16} className="mt-0.5 shrink-0" />
          {offer.why}
        </p>
      )}

      <div className="mt-4 md3-actions-row">
        {evaluatedN || doneEval ? (
          <a href={reportHref} className="md3-btn-filled w-full min-h-11">
            <MaterialSymbol name="check" size={18} /> Evaluated · view report
          </a>
        ) : working ? (
          <div className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-secondary-container)] text-sm font-medium text-[var(--md-sys-color-on-secondary-container)]">
            <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
            {statusLabel}
          </div>
        ) : (
          <>
            <Md3ActionButton
              variant={isAdded ? "filled" : "outlined"}
              icon={isAdding ? undefined : isAdded ? "check" : "add"}
              loading={isAdding}
              disabled={isAdded || isAdding}
              onClick={() => addToPipeline([offer])}
              className="flex-1"
            >
              {isAdded ? "In pipeline" : "Add to pipeline"}
            </Md3ActionButton>
            <Md3ActionButton variant="outlined" icon="bolt" cost="spend" onClick={evaluate} className="flex-1">
              Evaluate
            </Md3ActionButton>
          </>
        )}
      </div>
    </article>
  );
}
