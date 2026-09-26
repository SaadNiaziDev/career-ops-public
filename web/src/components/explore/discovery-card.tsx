"use client";

import { useMemo, useState } from "react";
import { ATS_LABEL, type AtsSource, type DiscoveredOffer } from "@/lib/explore";
import { useJobs } from "@/components/jobs/job-store";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useExplore } from "./explore-provider";
import { jobDestinationHref, resolveReportNum } from "@/components/jobs/job-utils";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import Link from "next/link";

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
  const [checking, setChecking] = useState(false);
  const [verification, setVerification] = useState(offer.verification);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

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

  const evaluate = async () => {
    if (offer.kind === "hiring-signal") return;
    setChecking(true); setVerifyMessage("");
    try {
      const response = await fetch("/api/explore/liveness", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({urls:[offer.url]})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not verify this posting.");
      const hit = result.results?.[0];
      if (hit?.result === "expired") { setVerification("unconfirmed"); setVerifyMessage("This posting appears to be closed. Reopen it to confirm the source."); return; }
      if (hit?.result !== "active" && !confirmed) { setVerification("unconfirmed"); setVerifyMessage("The posting could not be confirmed automatically. Open it, confirm it is accepting applications, then check the box below."); return; }
      const next = startJob({ title: `Evaluate · ${offer.company}`, subtitle: offer.title, kind: "evaluate", input: offer.url, page: "/explore" });
      if (!next) { setVerifyMessage("Evaluation could not start. Check your AI engine in Config."); return; }
      await addToPipeline([offer]);
    } catch (error) { setVerifyMessage(error instanceof Error ? error.message : "Could not verify this posting."); }
    finally { setChecking(false); }
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
            Preliminary fit {offer.fitScore}/100
          </span>
        )}
        <span className="rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] px-2 py-0.5 font-medium text-[var(--md-sys-color-outline)]">
          {ATS_LABEL[offer.ats as AtsSource] ?? offer.ats}
        </span>
        {fresh && <span className="font-mono text-[var(--md-sys-color-outline)]">{fresh}</span>}
        {offer.kind === "hiring-signal" ? <span className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 font-medium">Hiring signal · not a vacancy</span> : null}
        {offer.confidence && <span>Confidence: {offer.confidence}</span>}
        {unverified && (
          <span className="inline-flex items-center gap-1 rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 font-medium text-[var(--md-sys-color-on-tertiary-container)]">
            unverified
          </span>
        )}
        {offer.discoveredFrom && <span>Source: {offer.discoveredFrom}</span>}
        {offer.discoveredAt && <span>Discovered {new Date(offer.discoveredAt).toLocaleDateString()}</span>}
        {offer.liveness && <span>Link: {offer.liveness === "active" ? "reachable" : offer.liveness === "expired" ? "closed" : "unconfirmed"}</span>}
      </div>

      {offer.why && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--md-sys-color-primary)]">
          <MaterialSymbol name="auto_awesome" size={16} className="mt-0.5 shrink-0" />
          {offer.why}
        </p>
      )}
      {!offer.why && offer.fitSignalReasons && offer.fitSignalReasons.length > 0 && (
        <p className="mt-2 mb-0 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          Matched on {offer.fitSignalReasons.slice(0, 2).join(" and ")}
        </p>
      )}
      {!offer.why && (!offer.fitSignalReasons || offer.fitSignalReasons.length === 0) && typeof offer.fitScore === "number" && (
        <p className="mt-2 mb-0 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          Ranked by CV and title overlap, compensation fit, freshness, and source trust.
        </p>
      )}

      <div className="mt-4 md3-actions-row">
        {offer.kind === "hiring-signal" ? (
          <a href={offer.url} target="_blank" rel="noopener noreferrer" className="md3-btn-outlined min-h-11 w-full"><MaterialSymbol name="open_in_new" size={18}/>Open public hiring signal</a>
        ) : evaluatedN || doneEval ? (
          <a href={reportHref} className="md3-btn-filled w-full min-h-11">
            <MaterialSymbol name="check" size={18} /> Evaluated · view report
          </a>
        ) : working ? (
          <div className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-secondary-container)] text-sm font-medium text-[var(--md-sys-color-on-secondary-container)]">
            <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
            {statusLabel}
          </div>
        ) : isAdded ? (
          <Link href="/pipeline?tab=INBOX" className="md3-btn-filled w-full min-h-11">
            <MaterialSymbol name="arrow_forward" size={18} /> Open in pipeline
          </Link>
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
              {checking ? "Checking posting…" : "Verify & evaluate"}
            </Md3ActionButton>
          </>
        )}
      </div>
      {verifyMessage && <div className="mt-3 space-y-2"><p role="status" className="text-sm">{verifyMessage}</p>{verifyMessage.includes("confirm it is accepting")&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I opened this vacancy and confirmed it is accepting applications.</label><button type="button" disabled={!confirmed||checking} onClick={()=>void evaluate()} className="md3-btn-filled min-h-10">Evaluate confirmed posting</button></>}</div>}
    </article>
  );
}
