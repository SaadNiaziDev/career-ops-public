"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/components/jobs/job-store";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { HeroGlow } from "@/components/hero-glow";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack, DossierInsetStack } from "@/components/dossier/dossier-stack";
import {
  collapseSteps,
  fmtElapsed,
  fmtTokens,
  formatCollapsedStep,
  humanizeJobKind,
  isAuthError,
  jobBackHref,
  jobDuration,
  resolveArtifacts,
  resolveReportNum,
  useElapsed,
} from "@/components/jobs/job-utils";
import { cn } from "@/lib/cn";
import { isActiveState, isStuck, type RunState } from "@/lib/jobs/run-policy";

const SCORE_BADGE_TONE: Record<string, "good" | "warn" | "bad" | "muted"> = {
  good: "good",
  warn: "warn",
  bad: "bad",
  muted: "muted",
};

function StatusTag({ state }: { state: RunState }) {
  if (state === "queued" || state === "running") {
    return (
      <Badge tone="muted" className="gap-1.5">
        <MaterialSymbol name="progress_activity" size={14} className="animate-spin" />
        {state === "queued" ? "Queued" : "Running"}
      </Badge>
    );
  }
  if (state === "completed") {
    return (
      <Badge tone="good" className="gap-1.5">
        <MaterialSymbol name="check_circle" size={14} filled />
        Completed
      </Badge>
    );
  }
  const label = state === "needs-attention" ? "Needs attention" : state === "cancelled" ? "Cancelled" : "Interrupted";
  return <Badge tone={state === "needs-attention" ? "bad" : "warn"} className="gap-1.5"><MaterialSymbol name="cancel" size={14} />{label}</Badge>;
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { jobs, startJob, cancelJob } = useJobs();
  const { applications } = usePipeline();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const job = jobs.find((j) => j.id === id);
  const running = job ? isActiveState(job.state) : false;
  const elapsed = useElapsed(running ?? false, job?.startedAt ?? Date.now());
  const inactiveFor = useElapsed(running, job?.lastActivityAt ?? Date.now());
  const artifacts = job ? resolveArtifacts(job, applications) : [];
  const reportN = job ? resolveReportNum(job, applications) : undefined;
  const steps = useMemo(() => (job ? collapseSteps(job.steps) : []), [job]);
  const [outputOpen, setOutputOpen] = useState<boolean | undefined>(undefined);
  const outputExpanded = outputOpen ?? running;

  if (!job) {
    return (
      <PageShell width="narrow">
        <DossierStack>
          <Link href="/pipeline">
            <Button variant="text" className="px-0">
              <MaterialSymbol name="arrow_back" size={18} />
              Pipeline
            </Button>
          </Link>
          <Md3Empty icon="memory" description="This worker is no longer in memory — it finished earlier or the page was reloaded.">
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/jobs">
                <Button variant="outline">Worker history</Button>
              </Link>
              <Link href="/pipeline">
                <Button variant="primary">Pipeline</Button>
              </Link>
            </div>
          </Md3Empty>
        </DossierStack>
      </PageShell>
    );
  }

  const backHref = jobBackHref(job);
  const backLabel = backHref === "/pipeline" ? "Pipeline" : backHref === "/jobs" ? "Workers" : "Back";
  const duration = running ? elapsed : jobDuration(job);
  const stuck = isStuck(job.state, job.lastActivityAt, job.lastActivityAt + inactiveFor);
  const authError = isAuthError(job);
  const tokens = job.state === "completed" ? job.cost?.tokens ?? 0 : 0;
  const canRetry = !isActiveState(job.state) && job.state !== "completed" && !!job.kind && !!job.input;

  const retry = () => {
    if (!canRetry || retrying) return;
    setRetrying(true);
    const newId = startJob({
      title: job.title,
      subtitle: job.subtitle,
      kind: job.kind!,
      input: job.input!,
      page: job.page,
      batchId: job.batchId,
      context: job.context,
    });
    if (newId) router.push(`/jobs/${newId}`);
    else setRetrying(false);
  };

  return (
    <PageShell width="narrow">
      <DossierStack>
        <nav className="flex flex-wrap items-center gap-2 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
          <Link href={backHref} className="inline-flex items-center gap-1 hover:text-[var(--md-sys-color-primary)]">
            <MaterialSymbol name="arrow_back" size={18} />
            {backLabel}
          </Link>
          {reportN ? (
            <>
              <span>/</span>
              <Link href={`/pipeline/${reportN}`} className="hover:text-[var(--md-sys-color-primary)]">
                Report #{reportN}
              </Link>
            </>
          ) : null}
          <span>/</span>
          <span>Worker</span>
        </nav>

        <Md3Card className="relative overflow-hidden !p-0">
          {running && <HeroGlow />}
          <DossierInsetStack className="relative z-10 p-[var(--card-pad-y)] px-[var(--card-pad-x)]">
            <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusTag state={job.state} />
                {job.result?.score != null && (
                  <Badge tone={SCORE_BADGE_TONE[job.result.tone] ?? "muted"}>{job.result.score}/5</Badge>
                )}
                <span className="text-xs tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
                  {fmtElapsed(duration)}
                  {running && ` · last activity ${fmtElapsed(inactiveFor)} ago`}
                </span>
              </div>
              {running ? (
                <Button variant="outline" size="sm" onClick={() => cancelJob(job.id)}>
                  <MaterialSymbol name="stop_circle" size={16} />
                  Cancel safely
                </Button>
              ) : canRetry && (
                <Button variant="outline" size="sm" disabled={retrying} onClick={retry}>
                  {retrying ? (
                    <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
                  ) : (
                    <MaterialSymbol name="refresh" size={16} />
                  )}
                  Retry
                </Button>
              )}
            </div>

            <div>
              <h1 className="mb-1 font-display text-2xl font-semibold text-[var(--md-sys-color-on-surface)]">{job.title}</h1>
              {job.subtitle && (
                <p className="mb-0 text-[var(--md-sys-color-on-surface-variant)]">{job.subtitle}</p>
              )}
              <p className="mt-1 text-xs text-[var(--md-sys-color-outline)]">{humanizeJobKind(job.kind)} · {job.steps.length} activity updates</p>
            </div>

            {stuck && (
              <div className="md3-alert md3-alert--warning">
                <MaterialSymbol name="schedule" size={18} className="shrink-0" />
                <span>No meaningful update for {fmtElapsed(inactiveFor)}. The worker may be waiting on a site or CLI; cancelling is safe.</span>
              </div>
            )}

            {job.state === "completed" && job.result?.summary && (
              <p className="mb-0 text-[var(--md-sys-color-on-surface-variant)]">{job.result.summary}</p>
            )}

            {(job.state === "needs-attention" || job.state === "interrupted" || job.state === "cancelled") && job.error && (
              <div className="md3-alert md3-alert--warning">
                <MaterialSymbol name="warning" size={18} className="shrink-0" />
                <span>{job.error}</span>
              </div>
            )}

            {artifacts.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {artifacts.map((artifact) => {
                  const external = artifact.href.startsWith("/api/");
                  const className = artifact.primary ? "md3-btn-filled" : "md3-btn-outlined";
                  const inner = (
                    <>
                      <MaterialSymbol name="description" size={18} />
                      {artifact.label}
                    </>
                  );
                  return (
                    <span key={artifact.href} className="inline-flex flex-wrap items-center gap-2">
                      {external ? (
                        <a href={artifact.href} target="_blank" rel="noreferrer" className={className}>
                          {inner}
                        </a>
                      ) : (
                        <Link href={artifact.href} className={className}>
                          {inner}
                        </Link>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {authError && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[var(--md-sys-color-tertiary)]">Sign your CLI in from Config, then re-run.</span>
                <Link href="/config">
                  <Button variant="outline">
                    <MaterialSymbol name="settings" size={18} />
                    Open Config
                  </Button>
                </Link>
                {canRetry && (
                  <Button variant="outline" disabled={retrying} onClick={retry}>
                    {retrying ? (
                      <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
                    ) : (
                      <MaterialSymbol name="refresh" size={16} />
                    )}
                    Retry
                  </Button>
                )}
              </div>
            )}

            {canRetry && !authError && (
              <Button variant="primary" disabled={retrying} onClick={retry}>
                {retrying ? (
                  <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
                ) : (
                  <MaterialSymbol name="refresh" size={18} />
                )}
                Retry
              </Button>
            )}
          </DossierInsetStack>
        </Md3Card>

        {steps.length > 0 && (
          <Md3Card
            title={<span className="font-medium text-[var(--md-sys-color-on-surface)]">Activity</span>}
            className="!p-0"
          >
            <ul className="space-y-3">
              {steps.map((step, i) => (
                <li key={`${step.label}-${i}`} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      step.kind === "tool"
                        ? "bg-[var(--md-sys-color-primary)]"
                        : "bg-[var(--md-sys-color-outline)]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      step.kind === "tool"
                        ? "text-[var(--md-sys-color-on-surface)]"
                        : "text-[var(--md-sys-color-on-surface-variant)]",
                    )}
                  >
                    {formatCollapsedStep(step)}
                  </span>
                </li>
              ))}
              {running ? (
                <li key="thinking" className="flex gap-3">
                  <MaterialSymbol name="progress_activity" size={16} className="mt-0.5 animate-spin text-[var(--md-sys-color-primary)]" />
                  <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Thinking…</span>
                </li>
              ) : null}
            </ul>
          </Md3Card>
        )}

        {job.text ? (
          <section className="md3-collapse">
            <button
              type="button"
              className="md3-collapse__header"
              aria-expanded={outputExpanded}
              onClick={() => setOutputOpen(!outputExpanded)}
            >
              <span className="min-w-0 flex-1 text-left">{running ? "Output (live)" : "Output"}</span>
              <MaterialSymbol
                name="expand_more"
                size={22}
                className={cn("transition-transform", outputExpanded && "rotate-180")}
              />
            </button>
            {outputExpanded ? (
              <div className="md3-collapse__body">
                {job.outputTruncated && (
                  <p className="mb-4 text-xs text-[var(--md-sys-color-outline)]">Showing the latest 24,000 characters. The saved report remains the canonical full result.</p>
                )}
                <div className="report-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.text}</ReactMarkdown>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tokens > 0 && (
          <details className="rounded-xl border border-[var(--md-sys-color-outline-variant)] px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
            <summary className="cursor-pointer font-medium text-[var(--md-sys-color-on-surface)]">Technical usage</summary>
            <p className="mt-2 mb-0">{fmtTokens(tokens)} model tokens processed{job.cost?.usd != null ? ` · estimated provider cost $${job.cost.usd.toFixed(2)}` : ""}.</p>
          </details>
        )}
      </DossierStack>
    </PageShell>
  );
}
