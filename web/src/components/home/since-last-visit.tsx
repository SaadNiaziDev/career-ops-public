"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Application } from "@/lib/career-ops";
import { useJobs } from "@/components/jobs/job-store";
import { MaterialSymbol } from "@/components/material-symbol";
import { canonStatus } from "@/lib/format";

// Blueprint S01 · gap 5 — "what changed since you last looked". Today opened on
// a queue with no memory of the previous visit, so an evaluation that finished
// while the tab was closed looked identical to one from last week.
//
// The snapshot is per-browser and deliberately small: the tracker row numbers
// and their statuses, plus the timestamp of the visit.

const KEY = "career-ops:last-visit";

type Snapshot = { ts: number; statuses: Record<string, string> };

/** Statuses that mean the company moved, not that we did. */
const REPLY_STATES = ["RESPONDED", "INTERVIEW", "OFFER", "REJECTED"];

function readSnapshot(): Snapshot | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Snapshot | null;
    if (!raw || typeof raw.ts !== "number" || !raw.statuses) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeSnapshot(applications: Application[]): void {
  const statuses: Record<string, string> = {};
  for (const a of applications) statuses[String(a.n)] = canonStatus(a.status);
  try {
    localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), statuses } satisfies Snapshot));
  } catch {
    /* private mode — the strip simply won't appear next time */
  }
}

function relative(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function SinceLastVisit({ applications }: { applications: Application[] }) {
  const { jobs } = useJobs();
  // Read once on mount, BEFORE the new snapshot is written — otherwise the
  // strip would always compare the visit against itself.
  const [previous, setPrevious] = useState<Snapshot | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setPrevious(readSnapshot());
  }, []);

  useEffect(() => {
    if (previous === undefined) return;
    writeSnapshot(applications);
  }, [previous, applications]);

  const changes = useMemo(() => {
    if (!previous) return null;
    const evaluated: Application[] = [];
    const replied: Application[] = [];
    for (const a of applications) {
      const before = previous.statuses[String(a.n)];
      const now = canonStatus(a.status);
      if (before === undefined) evaluated.push(a);
      else if (before !== now && REPLY_STATES.some((s) => now.includes(s))) replied.push(a);
    }
    const finished = jobs.filter((j) => j.status !== "running" && (j.endedAt ?? 0) > previous.ts);
    return { evaluated, replied, finished };
  }, [previous, applications, jobs]);

  if (!changes || dismissed) return null;
  const total = changes.evaluated.length + changes.replied.length + changes.finished.length;
  if (total === 0) return null;

  return (
    <div className="since-strip" role="status">
      <MaterialSymbol name="history" size={20} className="shrink-0 text-[var(--md-sys-color-primary)]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Since you last looked · {relative(previous!.ts)}</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--md-sys-color-on-surface-variant)]">
          {changes.evaluated.length > 0 && (
            <li>
              <Link href="/pipeline?tab=EVALUATED" className="text-[var(--md-sys-color-primary)] hover:underline">
                {changes.evaluated.length} new evaluation{changes.evaluated.length === 1 ? "" : "s"}
              </Link>
            </li>
          )}
          {changes.replied.length > 0 && (
            <li>
              <Link href="/pipeline" className="text-[var(--md-sys-color-primary)] hover:underline">
                {changes.replied.length} new repl{changes.replied.length === 1 ? "y" : "ies"}
              </Link>
              <span className="ml-1 opacity-80">
                ({changes.replied.map((a) => a.company).slice(0, 3).join(", ")})
              </span>
            </li>
          )}
          {changes.finished.length > 0 && (
            <li>
              {changes.finished.length} worker{changes.finished.length === 1 ? "" : "s"} finished while you were away
            </li>
          )}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss what changed"
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <MaterialSymbol name="close" size={18} />
      </button>
    </div>
  );
}
