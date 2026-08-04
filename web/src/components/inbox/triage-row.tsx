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
  if (age === 1) return "yesterday";
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
    <li>
      <article
        className={cn(
          "group relative flex h-full flex-col rounded-2xl border border-border bg-surface/60 p-4 transition-all duration-150",
          "hover:border-brand/35 hover:bg-surface-hover/80 hover:shadow-md hover:shadow-black/5",
          selected && "border-brand/50 bg-brand-soft/40 ring-1 ring-brand/25",
          evaluated && "border-border/80",
        )}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${job.company} ${job.role}`}
            className="mt-1 size-4 shrink-0 accent-brand"
          />
          <CompanyLogo name={job.company} size={28} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug text-foreground">{job.company}</p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">{job.role}</p>
          </div>
          {evaluated && (
            <Link
              href={`/jobs/${scored!.jobId}`}
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {scored!.running ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                  <MaterialSymbol name="progress_activity" size={14} className="animate-spin" />
                  Scoring
                </span>
              ) : (
                <Badge tone={scored!.tone}>{scored!.score}/5</Badge>
              )}
            </Link>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
          {job.location && (
            <span className="max-w-full truncate rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[11px] text-muted">
              {job.location}
            </span>
          )}
          {source && (
            <span className="rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
              {ATS_LABEL[source]}
            </span>
          )}
          {ago && <span className="text-[11px] tabular-nums text-faint">{ago}</span>}
          {!evaluated && (
            <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] italic text-faint">
              Not scored
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 pl-7">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-brand"
          >
            View posting
            <MaterialSymbol name="open_in_new" size={14} />
          </a>
          {!evaluated && (
            <div className="md3-actions-row ml-auto">
              <Md3ActionButton
                variant={shortlisted ? "filled" : "outlined"}
                icon={shortlisted ? "bookmark" : "bookmark_border"}
                onClick={onSave}
                aria-pressed={shortlisted}
                className={cn(shortlisted && "border-brand/40 text-brand")}
              >
                {shortlisted ? "Saved" : "Save"}
              </Md3ActionButton>
              <Md3ActionButton variant="text" icon="close" onClick={onSkip} aria-label={`Skip ${job.company}`}>
                Skip
              </Md3ActionButton>
            </div>
          )}
        </div>
      </article>
    </li>
  );
}
