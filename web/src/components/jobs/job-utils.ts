"use client";

import { useEffect, useState } from "react";
import type { Job, JobStep } from "@/components/jobs/job-store";
import type { Application } from "@/lib/career-ops";

const STEP_LABELS: Record<string, string> = {
  WebFetch: "Reading the posting",
  WebSearch: "Searching the web",
  Read: "Reading your CV & profile",
  Glob: "Looking through your files",
  Grep: "Looking through your files",
  Write: "Writing the report",
  Edit: "Updating the report",
  NotebookEdit: "Updating the report",
  Bash: "Saving to your tracker",
  TodoWrite: "Planning the steps",
  Task: "Working",
};

export function humanizeStep(label: string): string {
  return STEP_LABELS[label] ?? label;
}

export function isAuthError(job: Job): boolean {
  if (job.status !== "error") return false;
  const hay = `${job.steps[job.steps.length - 1]?.label ?? ""} ${job.text}`.toLowerCase();
  return /auth|login|sign[ -]?in|credential|api[ -]?key|unauthorized|not authenticated|installed and authenticated/.test(hay);
}

export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export function useElapsed(running: boolean, startedAt: number): number {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running, startedAt]);
  return Math.max(0, now - startedAt);
}

export type CollapsedStep = {
  label: string;
  count: number;
  kind: JobStep["kind"];
};

export function collapseSteps(steps: JobStep[]): CollapsedStep[] {
  const result: CollapsedStep[] = [];
  for (const s of steps) {
    const label = s.kind === "tool" ? humanizeStep(s.label) : s.label;
    const last = result[result.length - 1];
    if (last && last.label === label) {
      last.count += 1;
    } else {
      result.push({ label, count: 1, kind: s.kind });
    }
  }
  return result;
}

export function formatCollapsedStep(step: CollapsedStep): string {
  return step.count > 1 ? `${step.label} ×${step.count}` : step.label;
}

export type JobArtifact = {
  label: string;
  href: string;
  path?: string;
  download?: boolean;
  primary?: boolean;
};

export function extractReportNum(hay: string): string | undefined {
  const m =
    hay.match(/reports\/(\d+)/i) ||
    hay.match(/\[(\d+)\]\((?:\.\.\/)?reports\//i) ||
    hay.match(/batch\/tracker-additions\/(\d+)/i) ||
    hay.match(/\/pipeline\/(\d+)/);
  return m?.[1];
}

export function sameReportNum(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  return !Number.isNaN(na) && na === nb;
}

function extractPdfPath(hay: string): string | undefined {
  return hay.match(/output\/[^\s"'`]+\.pdf/i)?.[0];
}

function companyFromJobTitle(title: string): string | undefined {
  const m = title.match(/^(?:Score|Evaluate|CV PDF|Cover|Email|Contacts) · (.+)$/i);
  return m?.[1]?.trim() || undefined;
}

function companyFromPdfPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const base = path.split("/").pop() ?? path;
  const parts = base.replace(/\.pdf$/i, "").split("-");
  if (parts.length < 3) return undefined;
  const slugParts = parts.slice(2);
  return slugParts.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizePostingUrl(raw: string): string {
  try {
    const u = new URL(raw);
    let host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "job-boards.greenhouse.io") host = "boards.greenhouse.io";
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function reportNumFromJob(job: Job): string | undefined {
  if (job.reportN) return job.reportN;
  if (job.page) {
    const fromPage = job.page.match(/\/pipeline\/(\d+)/)?.[1];
    if (fromPage) return fromPage;
  }
  if (job.input && /^\d+$/.test(job.input.trim())) return job.input.trim();
  return extractReportNum(`${job.result?.summary ?? ""}\n${job.text}`);
}

function reportNumFromApplications(job: Job, applications: Application[]): string | undefined {
  if (!applications.length) return undefined;
  const input = job.input?.trim();
  if (input && !/^\d+$/.test(input)) {
    const needle = normalizePostingUrl(input);
    const byUrl = applications.find((a) => a.url && normalizePostingUrl(a.url) === needle);
    if (byUrl) return byUrl.n;
  }
  const company = companyFromJobTitle(job.title);
  const role = job.subtitle?.trim();
  if (!company || !role) return undefined;
  const hits = applications.filter(
    (a) =>
      a.company.trim().toLowerCase() === company.toLowerCase() &&
      a.role.trim().toLowerCase() === role.toLowerCase(),
  );
  if (hits.length === 0) return undefined;
  return hits.sort((a, b) => parseInt(b.n, 10) - parseInt(a.n, 10))[0]?.n;
}

export function resolveReportNum(job: Job, applications: Application[] = []): string | undefined {
  return reportNumFromJob(job) ?? reportNumFromApplications(job, applications);
}

export function resolveArtifacts(job: Job, applications: Application[] = []): JobArtifact[] {
  if (job.status !== "done") return [];

  const artifacts: JobArtifact[] = [];
  const reportN = resolveReportNum(job, applications);
  if (reportN) {
    artifacts.push({
      label: "Open report",
      href: `/pipeline/${reportN}`,
      primary: true,
    });
  }

  const hay = `${job.result?.summary ?? ""}\n${job.text}`;
  const pdfPath = extractPdfPath(hay);
  if (job.kind === "pdf" || pdfPath) {
    const company = companyFromJobTitle(job.title) ?? companyFromPdfPath(pdfPath);
    if (company) {
      artifacts.push({
        label: "View tailored CV",
        href: `/api/cv-pdf?company=${encodeURIComponent(company)}`,
        path: pdfPath,
        download: false,
        primary: artifacts.length === 0,
      });
    } else if (pdfPath) {
      artifacts.push({
        label: "View file",
        href: `/api/cv-pdf?company=${encodeURIComponent(companyFromPdfPath(pdfPath) ?? "unknown")}`,
        path: pdfPath,
        primary: artifacts.length === 0,
      });
    }
  }

  return artifacts;
}

export function resolveArtifact(job: Job, applications: Application[] = []): JobArtifact | null {
  return resolveArtifacts(job, applications)[0] ?? null;
}

export function jobDestinationHref(job: Job, applications: Application[] = []): string {
  if (job.status === "done") {
    const n = resolveReportNum(job, applications);
    if (n && ["evaluate", "pdf", "cover", "email", "contacto"].includes(job.kind ?? "")) {
      return `/pipeline/${n}`;
    }
  }
  return `/jobs/${job.id}`;
}

export function findJobForReport(jobs: Job[], reportN: string, url?: string): Job | undefined {
  const byNum = jobs.find((j) => sameReportNum(resolveReportNum(j), reportN) || sameReportNum(j.input, reportN));
  if (byNum) return byNum;
  if (!url) return undefined;
  const needle = normalizePostingUrl(url);
  return jobs.find((j) => j.input && normalizePostingUrl(j.input) === needle);
}

export function jobBackHref(job: Job | undefined): string {
  if (job?.page) return job.page;
  return "/pipeline";
}

export const SCORE_TAG_COLOR: Record<string, string> = {
  good: "success",
  warn: "warning",
  bad: "error",
  muted: "default",
};

export function jobDuration(job: Job): number {
  const end = job.endedAt ?? Date.now();
  return Math.max(0, end - job.startedAt);
}
