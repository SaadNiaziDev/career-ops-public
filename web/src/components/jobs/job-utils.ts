"use client";

import { useEffect, useState } from "react";
import type { Job, JobStep } from "@/components/jobs/job-store";

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
};

function extractPdfPath(hay: string): string | undefined {
  return hay.match(/output\/[^\s"'`]+\.pdf/i)?.[0];
}

function companyFromTitle(title: string): string | undefined {
  const m = title.match(/^CV PDF · (.+)$/i);
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

export function resolveArtifact(job: Job): JobArtifact | null {
  if (job.status !== "done") return null;

  const hay = `${job.result?.summary ?? ""}\n${job.text}`;
  const pdfPath = extractPdfPath(hay);

  if (job.kind === "pdf" || pdfPath) {
    const company = companyFromTitle(job.title) ?? companyFromPdfPath(pdfPath);
    if (company) {
      return {
        label: "View tailored CV",
        href: `/api/cv-pdf?company=${encodeURIComponent(company)}`,
        path: pdfPath,
        download: false,
      };
    }
  }

  const reportFromText = hay.match(/reports\/(\d+)/i)?.[1] ?? hay.match(/\[(\d+)\]\(reports\//i)?.[1];
  const reportFromInput = job.input && /^\d+$/.test(job.input.trim()) ? job.input.trim() : undefined;
  const reportN = reportFromText ?? reportFromInput;
  if (reportN) {
    return {
      label: "Open report",
      href: `/pipeline/${reportN}`,
    };
  }

  if (pdfPath) {
    return {
      label: "View file",
      href: `/api/cv-pdf?company=${encodeURIComponent(companyFromPdfPath(pdfPath) ?? "unknown")}`,
      path: pdfPath,
    };
  }

  return null;
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
