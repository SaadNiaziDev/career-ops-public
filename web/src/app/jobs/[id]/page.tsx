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
import { HeroGlow } from "@/components/hero-glow";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack, DossierInsetStack } from "@/components/dossier/dossier-stack";
import {
  collapseSteps,
  fmtElapsed,
  fmtTokens,
  formatCollapsedStep,
  isAuthError,
  jobBackHref,
  jobDuration,
  resolveArtifact,
  useElapsed,
} from "@/components/jobs/job-utils";
import { cn } from "@/lib/cn";

const SCORE_BADGE_TONE: Record<string, "good" | "warn" | "bad" | "muted"> = {
  good: "good",
  warn: "warn",
  bad: "bad",
  muted: "muted",
};

function StatusTag({ status }: { status: "running" | "done" | "error" }) {
  if (status === "running") {
    return (
      <Badge tone="muted" className="gap-1.5">
        <MaterialSymbol name="progress_activity" size={14} className="animate-spin" />
        Working
      </Badge>
    );
  }
  if (status === "done") {
    return (
      <Badge tone="good" className="gap-1.5">
        <MaterialSymbol name="check_circle" size={14} filled />
        Done
      </Badge>
    );
  }
  return (
    <Badge tone="bad" className="gap-1.5">
      <MaterialSymbol name="cancel" size={14} />
      Error
    </Badge>
  );
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { jobs, startJob } = useJobs();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const job = jobs.find((j) => j.id === id);
  const running = job?.status === "running";
  const elapsed = useElapsed(running ?? false, job?.startedAt ?? Date.now());
  const artifact = job ? resolveArtifact(job) : null;
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
  const authError = isAuthError(job);
  const tokens = job.status === "done" ? job.cost?.tokens ?? 0 : 0;
  const canRetry = job.status === "error" && !!job.kind && !!job.input;

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
    });
    if (newId) router.push(`/jobs/${newId}`);
    else setRetrying(false);
  };

  return (
    <PageShell width="narrow">
      <DossierStack>
        <Link href={backHref}>
          <Button variant="text" className="px-0">
            <MaterialSymbol name="arrow_back" size={18} />
            {backLabel}
          </Button>
        </Link>

        <Md3Card className="relative overflow-hidden !p-0">
          {running && <HeroGlow />}
          <DossierInsetStack className="relative z-10 p-[var(--card-pad-y)] px-[var(--card-pad-x)]">
            <div className="flex w-full flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <StatusTag status={job.status} />
                {job.result?.score != null && (
                  <Badge tone={SCORE_BADGE_TONE[job.result.tone] ?? "muted"}>{job.result.score}/5</Badge>
                )}
                <span className="text-xs tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
                  {fmtElapsed(duration)}
                  {tokens > 0 && ` · ${fmtTokens(tokens)} tokens`}
                  {job.cost?.usd != null && ` · $${job.cost.usd.toFixed(2)}`}
                </span>
              </div>
              {canRetry && (
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
            </div>

            {job.status === "done" && job.result?.summary && !artifact && (
              <p className="mb-0 text-[var(--md-sys-color-on-surface-variant)]">{job.result.summary}</p>
            )}

            {artifact && (
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={artifact.href}
                  target={artifact.href.startsWith("/api/") ? "_blank" : undefined}
                  rel={artifact.href.startsWith("/api/") ? "noreferrer" : undefined}
                  className="md3-btn-filled"
                >
                  <MaterialSymbol name="description" size={18} />
                  {artifact.label}
                </a>
                {artifact.path && (
                  <code className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{artifact.path}</code>
                )}
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
                <div className="report-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.text}</ReactMarkdown>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </DossierStack>
    </PageShell>
  );
}
