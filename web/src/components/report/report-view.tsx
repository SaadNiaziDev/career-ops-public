"use client";

import Link from "next/link";
import type { Application } from "@/lib/career-ops";
import { scoreNum, legitimacyTone, parseMachineSummary, statusDot } from "@/lib/format";
import { StatusSelect } from "@/components/track/status-select";
import { CompanyLogo } from "@/components/ui/company-logo";
import { ApplyButton } from "@/components/apply/apply-button";
import { ApplicationRecordPanel } from "@/components/track/application-record";
import type { ApplicationRecord } from "@/lib/application-records";
import { DeleteFromTracker } from "@/components/track/delete-from-tracker";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { PageShell } from "@/components/ui/page-shell";
import { DossierStack } from "@/components/ui/stack";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Empty } from "@/components/ui/md3-empty";
import { useJobs } from "@/components/jobs/job-store";
import { findJobForReport } from "@/components/jobs/job-utils";
import { TONE_TEXT as TONE_TEXT_ROLES } from "@/lib/tone";
import { cn } from "@/lib/cn";
import { parseReportDocument } from "@/lib/core/report-document.mjs";
import { ReportBody } from "./report-body";

const TONE_TEXT = TONE_TEXT_ROLES;

function formatScoreDisplay(score: string): string {
  const n = scoreNum(score);
  if (!Number.isNaN(n)) return n % 1 === 0 ? n.toFixed(1) : String(n);
  return score;
}

export function ReportView({
  id,
  app,
  report,
  canDelete = false,
  record,
  drafts = [],
}: {
  id: string;
  app: Application | null;
  report: string | null;
  file?: string | null;
  canDelete?: boolean;
  record?: ApplicationRecord;
  drafts?: { kind: string; content: string }[];
}) {
  const parsedDocument = report ? parseReportDocument(report) : null;
  const meta = parsedDocument ? {
    title: parsedDocument.title,
    fields: parsedDocument.fields,
    legitimacy: parsedDocument.legitimacy,
    body: parsedDocument.body,
  } : null;
  const machineSummary = parsedDocument?.machineSummary as ReturnType<typeof parseMachineSummary>;
  const field = (label: string) => meta?.fields.find((f) => f.label === label)?.value;
  const score = app?.score || field("Score");
  const date = app?.date || field("Date");
  const archetype = field("Archetype");
  const url = field("URL") || app?.url;

  const n = scoreNum(score ?? "");
  const applies = !Number.isNaN(n) ? n >= 4.0 : null;
  const company = app?.company ?? meta?.title ?? `Report #${id}`;
  const { jobs } = useJobs();
  const originJob = findJobForReport(jobs, id, url || app?.url);

  return (
    <PageShell width="wide" className="report-page">
      <DossierStack>
        <nav className="flex items-center gap-2 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
          <Link href="/pipeline" className="inline-flex items-center gap-1 hover:text-[var(--md-sys-color-primary)]">
            <MaterialSymbol name="arrow_back" size={18} />
            Track
          </Link>
          <span>/</span>
          <span className="font-mono md-body-small">#{id}</span>
          {app?.status && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--md-sys-color-outline-variant)] px-3 py-1 md-body-small">
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", statusDot(app.status))} />
              {app.status}
            </span>
          )}
          {originJob ? (
            <>
              <span>/</span>
              <Link href={`/jobs/${originJob.id}`} className="hover:text-[var(--md-sys-color-primary)]">
                Worker log
              </Link>
            </>
          ) : null}
        </nav>

        <header className="flex flex-wrap items-start gap-5">
          <CompanyLogo name={company} size={64} className="rounded-[var(--md-sys-shape-corner-large-increased)]" />
          <div className="min-w-0 flex-1">
            <h1 className="md-headline-medium break-words text-[var(--md-sys-color-on-surface)]">{company}</h1>
            {app?.role && (
              <p className="mt-1 break-words md-title-large text-[var(--md-sys-color-on-surface-variant)]">{app.role}</p>
            )}
          </div>
          {score && !record && (
            <div className="shrink-0 text-right">
              <span className="block text-[64px] font-bold leading-none text-[var(--md-sys-color-primary)] tabular-nums">
                {formatScoreDisplay(score)}
              </span>
              <span className="md-body-small text-[var(--md-sys-color-outline)]">/5</span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {record && <ApplicationRecordPanel initial={record} drafts={drafts} />}
            <details open={!record} className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4">
              <summary className="cursor-pointer font-medium">Evaluation &amp; evidence</summary>
              <div className="mt-4">
            {report ? (
              <ReportBody
                body={meta?.body ?? report}
                score={score}
                applies={applies}
                notes={app?.notes}
                machineSummary={machineSummary}
                legitimacy={meta?.legitimacy}
                parsedIntro={parsedDocument?.intro ?? ""}
                parsedSections={parsedDocument?.sections ?? []}
                warnings={parsedDocument?.warnings ?? []}
              />
            ) : (
              <Md3Empty
                icon="description"
                description={
                  <>
                    No report file found for #{id} in <code>reports/</code>.
                  </>
                }
              />
            )}
              </div>
            </details>
          </div>

          <aside className="dossier-stack lg:sticky lg:top-6">
            <Md3Card title={<span className="md-title-small">Act on it</span>} className="report-meta-card">
              <ApplyButton n={id} company={company} url={url || app?.url} pdfReady={(app?.pdf ?? "").includes("✅")} status={app?.status} rail />
              {url && url.startsWith("http") && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="md3-btn-outlined mt-2 flex w-full"
                >
                  <MaterialSymbol name="open_in_new" size={18} />
                  View posting
                </a>
              )}
            </Md3Card>

            <Md3Card title={<span className="md-title-small">Status &amp; details</span>} className="report-meta-card">

              <div className="mt-1">
                {meta?.legitimacy && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Legitimacy</span>
                    <span className={cn("report-glance-value", TONE_TEXT[legitimacyTone(meta.legitimacy)])}>
                      {meta.legitimacy}
                    </span>
                  </div>
                )}
                {archetype && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Role type</span>
                    <span className="report-glance-value" title={archetype}>
                      {archetype}
                    </span>
                  </div>
                )}
                {date && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Evaluated</span>
                    <span className="report-glance-value">{date}</span>
                  </div>
                )}
                {app?.status && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Status</span>
                    <StatusSelect n={id} current={app.status} score={app.score} submissionRecorded={record?.events.some((event) => event.kind === "application")} />
                  </div>
                )}
              </div>

              {app && canDelete && (
                <div className="mt-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
                  <DeleteFromTracker n={id} />
                </div>
              )}
            </Md3Card>

          </aside>
        </div>
      </DossierStack>
    </PageShell>
  );
}
