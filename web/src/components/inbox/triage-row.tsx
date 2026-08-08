"use client";

import Link from "next/link";
import type { InboxJob } from "@/lib/career-ops";
import type { AtsSource } from "@/lib/explore";
import { ATS_LABEL } from "@/lib/explore";
import { Badge } from "@/components/ui/badge";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { MaterialSymbol } from "@/components/material-symbol";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/cn";

export type RowScore = { score: number | null; tone: "good" | "warn" | "bad" | "muted"; jobId: string; running: boolean };

function agoLabel(age: number | null): string | null {
  if (age == null) return null;
  if (age <= 0) return "today";
  if (age === 1) return "1d ago";
  if (age < 7) return `${age}d ago`;
  if (age < 30) return `${Math.floor(age / 7)}w ago`;
  return `${Math.floor(age / 30)}mo ago`;
}

export function TriageRow({
  job,
  source,
  age,
  scored,
  selected,
  shortlisted,
  onToggleSelect,
  onSave,
  onSkip,
}: {
  job: InboxJob;
  source: AtsSource | null;
  age: number | null;
  scored?: RowScore;
  selected: boolean;
  shortlisted: boolean;
  onToggleSelect: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const ago = agoLabel(age);
  const evaluated = !!scored && (scored.running || scored.score != null);

  return (
    <div className="md3-pipeline-list-row">
      <button
        type="button"
        onClick={onToggleSelect}
        aria-label={`Select ${job.company} ${job.role}`}
        aria-pressed={selected}
        className="inline-flex size-[22px] shrink-0 items-center justify-center text-[var(--md-sys-color-outline)]"
      >
        <MaterialSymbol name={selected ? "check_box" : "check_box_outline_blank"} size={22} filled={selected} />
      </button>

      <CompanyLogo name={job.company} size={40} className="shrink-0" />

      <div className="min-w-0 max-w-[300px]">
        <p className="truncate text-base font-medium text-[var(--md-sys-color-on-surface)]">{job.company}</p>
        <p className="truncate text-[13px] text-[var(--md-sys-color-on-surface-variant)]">{job.role}</p>
      </div>

      <span className="hidden w-[150px] truncate text-[13px] text-[var(--md-sys-color-on-surface-variant)] md:block">
        {job.location || "—"}
      </span>

      {source ? (
        <span className="hidden h-7 items-center rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] px-2.5 text-xs font-medium text-[var(--md-sys-color-outline)] sm:inline-flex">
          {ATS_LABEL[source]}
        </span>
      ) : (
        <span className="hidden sm:block" />
      )}

      {ago && (
        <span className="hidden w-[70px] font-mono text-xs tabular-nums text-[var(--md-sys-color-outline)] sm:block">
          {ago}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {evaluated ? (
          <Link href={`/jobs/${scored!.jobId}`} onClick={(e) => e.stopPropagation()}>
            {scored!.running ? (
              <span className="inline-flex items-center gap-1.5 rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-secondary-container)] px-3 py-1 text-xs font-medium text-[var(--md-sys-color-on-secondary-container)]">
                <MaterialSymbol name="progress_activity" size={14} className="animate-spin" />
                Scoring
              </span>
            ) : (
              <Badge tone={scored!.tone}>{scored!.score}/5</Badge>
            )}
          </Link>
        ) : (
          <>
            <Md3ActionButton
              variant={shortlisted ? "filled" : "outlined"}
              icon={shortlisted ? "bookmark" : "bookmark_border"}
              onClick={onSave}
              aria-pressed={shortlisted}
              className="min-h-10"
            >
              {shortlisted ? "Saved" : "Save"}
            </Md3ActionButton>
            <Md3ActionButton variant="text" icon="close" onClick={onSkip} aria-label={`Skip ${job.company}`} className="min-h-10">
              Skip
            </Md3ActionButton>
          </>
        )}
      </div>
    </div>
  );
}
