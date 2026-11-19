"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { CompanyLogo } from "@/components/ui/company-logo";
import { cn } from "@/lib/cn";
import type { QueueItem } from "@/lib/apply/kit";

/** Evaluated roles not applied yet, best score first, with what's prepared for each. */
export function ApplyQueue({ initialQueue }: { initialQueue: QueueItem[] }) {
  const [queue, setQueue] = useState(initialQueue);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const refresh = () =>
      fetch("/api/apply/kit", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { queue?: QueueItem[] } | null) => d?.queue && setQueue(d.queue))
        .catch(() => {});
    window.addEventListener("co-job-done", refresh);
    return () => window.removeEventListener("co-job-done", refresh);
  }, []);

  const strong = queue.filter((q) => q.app.score >= 4).length;
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return queue
      .filter((item) => showAll || item.app.score >= 4)
      .filter((item) => !q || `${item.app.company} ${item.app.role}`.toLowerCase().includes(q));
  }, [queue, showAll, filter]);

  return (
    <div className="search-page">
      <header className="search-head">
        <div>
          <h1 className="md-headline-medium">Apply</h1>
          <p className="search-sub">
            Roles you evaluated and haven&apos;t applied to yet. Open one to prepare the CV, cover letter, answers and email, then apply yourself.
          </p>
        </div>
        <Link href="/apply?view=form" className="md3-action-btn md3-action-btn--outlined">
          <MaterialSymbol name="link" size={18} />
          <span className="md3-action-btn__label">Fill any application form</span>
        </Link>
      </header>

      <div className="search-bar">
        <div className="search-tabs" role="tablist">
          <button role="tab" aria-selected={!showAll} className="search-tab" data-active={!showAll} onClick={() => setShowAll(false)}>
            Worth applying (4.0+)<span className="search-tab__count">{strong}</span>
          </button>
          <button role="tab" aria-selected={showAll} className="search-tab" data-active={showAll} onClick={() => setShowAll(true)}>
            All evaluated<span className="search-tab__count">{queue.length}</span>
          </button>
        </div>
        <div className="search-filters">
          <label className="search-filter">
            <MaterialSymbol name="filter_list" size={18} />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by role or company" aria-label="Filter roles" />
          </label>
        </div>
      </div>

      <div className="search-table" role="table" aria-label="Roles to apply to">
        <div className="search-row search-row--head apply-row" role="row">
          <span role="columnheader">Role</span>
          <span role="columnheader">Score</span>
          <span role="columnheader">Prepared</span>
          <span role="columnheader">Evaluated</span>
          <span role="columnheader" className="search-actions-col">Actions</span>
        </div>
        {visible.length === 0 ? (
          <p className="search-empty">
            {showAll ? "Nothing evaluated yet. Evaluate jobs on the Search page." : "No roles at 4.0 or above waiting. Check All evaluated, or evaluate more jobs on Search."}
          </p>
        ) : (
          visible.map((item) => {
            const s = item.app.score;
            return (
              <div key={item.app.n} className="search-row apply-row" role="row">
                <div className="search-role" role="cell">
                  <CompanyLogo name={item.app.company} size={36} />
                  <div className="min-w-0">
                    <Link href={`/apply?n=${item.app.n}`} className="search-role__title">{item.app.role}</Link>
                    <div className="search-role__company">{item.app.company} · #{item.app.n}</div>
                  </div>
                </div>
                <span role="cell">
                  <span className={cn("search-score", s >= 4 ? "search-score--good" : s >= 3.5 ? "search-score--mid" : "search-score--low")}>{s ? s.toFixed(1) : "—"}</span>
                </span>
                <span role="cell" className="apply-prep">
                  <Prep done={item.cvReady} label="CV" />
                  <Prep done={item.coverReady} label="Cover" muted={item.coverNeed === "none"} />
                  <Prep done={item.total > 0 && item.answered >= item.total} label={item.total ? `Answers ${item.answered}/${item.total}` : "Answers"} />
                </span>
                <span role="cell" className="search-cell">{item.app.date || "—"}</span>
                <div role="cell" className="search-actions">
                  <Link href={`/apply?n=${item.app.n}`} className="md3-action-btn md3-action-btn--filled search-btn">
                    <span className="md3-action-btn__label">Prepare &amp; apply</span>
                  </Link>
                  {item.app.url && (
                    <a href={item.app.url} target="_blank" rel="noreferrer" className="search-icon-btn" title="Open posting" aria-label={`Open ${item.app.role} posting`}>
                      <MaterialSymbol name="open_in_new" size={18} />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Prep({ done, label, muted }: { done: boolean; label: string; muted?: boolean }) {
  return (
    <span className={cn("apply-prep__item", done && "apply-prep__item--done", muted && !done && "apply-prep__item--muted")}>
      <MaterialSymbol name={done ? "check_circle" : "radio_button_unchecked"} size={16} filled={done} />
      {label}
    </span>
  );
}
