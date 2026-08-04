"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Application, InboxJob } from "@/lib/career-ops";
import { CompanyLogo } from "@/components/company-logo";
import { MaterialSymbol } from "@/components/material-symbol";
import { canonStatus, scoreNum, scoreTone, statusDot } from "@/lib/format";
import { InboxTriage } from "@/components/inbox/inbox-triage";
import { PipelineRowActions } from "@/components/pipeline/pipeline-row-actions";
import { PageShell } from "@/components/dossier/page-shell";
import { JobLinkHub } from "@/components/job-link-hub";
import { cn } from "@/lib/cn";

const STAGES = [
  { key: "EVALUATED", label: "Evaluated", stage: "evaluated" as const },
  { key: "APPLIED", label: "Applied", stage: "applied" as const },
  { key: "RESPONDED", label: "Responded", stage: "responded" as const },
  { key: "INTERVIEW", label: "Interview", stage: "interview" as const },
  { key: "OFFER", label: "Offer", stage: "offer" as const },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

const CLOSED = ["REJECTED", "DISCARDED", "SKIP"] as const;

const TABS = ["INBOX", "ALL", ...STAGES.map((s) => s.key), ...CLOSED] as const;
type Tab = (typeof TABS)[number];

const SORT_KEYS = ["company", "role", "score", "status", "date"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const BOARD_CAP = 10;

const STAGE_TAB_ITEMS = [
  { key: "INBOX" as const, label: "Inbox" },
  ...STAGES.map((s) => ({ key: s.key as Tab, label: s.label })),
];

export function PipelineView({
  applications,
  inbox,
}: {
  applications: Application[];
  inbox: InboxJob[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const pTab = (params.get("tab") ?? "").toUpperCase();
  const tab: Tab = (TABS as readonly string[]).includes(pTab) ? (pTab as Tab) : "INBOX";
  const view = params.get("view") === "table" ? "table" : "board";
  const mode: "inbox" | "board" | "table" =
    tab === "INBOX" ? "inbox" : tab !== "ALL" || view === "table" ? "table" : "board";

  const pMin = parseFloat(params.get("min") ?? "");
  const minFilter: number | null = Number.isFinite(pMin) ? pMin : null;
  const pSort = params.get("sort") ?? "";
  const sortKey: SortKey = (SORT_KEYS as readonly string[]).includes(pSort) ? (pSort as SortKey) : "score";
  const sortDir = params.get("dir") === "1" ? 1 : -1;

  const [q, setQ] = useState(params.get("q") ?? "");
  const lastUrlQ = useRef(params.get("q") ?? "");
  useEffect(() => {
    const urlQ = params.get("q") ?? "";
    if (urlQ !== lastUrlQ.current) {
      lastUrlQ.current = urlQ;
      setQ(urlQ);
    }
  }, [params]);

  const setParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, String(v));
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, router, pathname],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = q.trim();
      if (trimmed === (params.get("q") ?? "")) return;
      setParams({ q: trimmed || null });
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, setParams]);

  const pendingInbox = useMemo(() => {
    const seen = new Set<string>();
    const out: InboxJob[] = [];
    for (const j of inbox) {
      if (j.done || seen.has(j.url)) continue;
      seen.add(j.url);
      out.push(j);
    }
    return out;
  }, [inbox]);

  const byStage = useMemo(() => {
    const buckets = new Map<StageKey, Application[]>(STAGES.map((s) => [s.key, []]));
    const closed: Application[] = [];
    for (const r of applications) {
      const c = canonStatus(r.status);
      const stage = STAGES.find((s) => c.includes(s.key));
      if (stage) buckets.get(stage.key)!.push(r);
      else closed.push(r);
    }
    const byScore = (a: Application, b: Application) => {
      const an = scoreNum(a.score);
      const bn = scoreNum(b.score);
      return (Number.isNaN(bn) ? -Infinity : bn) - (Number.isNaN(an) ? -Infinity : an);
    };
    for (const rows of buckets.values()) rows.sort(byScore);
    closed.sort(byScore);
    return { buckets, closed };
  }, [applications]);

  const stats = useMemo(() => {
    const scores = applications.map((r) => scoreNum(r.score)).filter((n) => !Number.isNaN(n));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const applyReady = (byStage.buckets.get("EVALUATED") ?? []).filter((r) => scoreNum(r.score) >= 4.0).length;
    const applied = (byStage.buckets.get("APPLIED") ?? []).length;
    const heard =
      (byStage.buckets.get("RESPONDED") ?? []).length +
      (byStage.buckets.get("INTERVIEW") ?? []).length +
      (byStage.buckets.get("OFFER") ?? []).length;
    const responseRate = applied > 0 ? Math.round((heard / applied) * 100) : null;
    return { avg, applyReady, responseRate };
  }, [applications, byStage]);

  const filtered = useMemo(() => {
    if (mode !== "table") return [];
    let rows = applications;
    if (tab !== "ALL") rows = rows.filter((r) => canonStatus(r.status).includes(tab));
    if (minFilter != null) {
      rows = rows.filter((r) => {
        const n = scoreNum(r.score);
        return !Number.isNaN(n) && n >= minFilter;
      });
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => `${r.company} ${r.role}`.toLowerCase().includes(needle));
    }
    return [...rows].sort((a, b) => {
      if (sortKey === "score") {
        const an = scoreNum(a.score);
        const bn = scoreNum(b.score);
        const av = Number.isNaN(an) ? -Infinity : an;
        const bv = Number.isNaN(bn) ? -Infinity : bn;
        return (av - bv) * sortDir;
      }
      return (a[sortKey] || "").localeCompare(b[sortKey] || "") * sortDir;
    });
  }, [applications, mode, tab, q, sortKey, sortDir, minFilter]);

  const goInbox = () => setParams({ tab: null, view: null, min: null });
  const goBoard = () => setParams({ tab: "ALL", view: null, min: null });
  const goTable = (t: Tab = "ALL") => setParams({ tab: t, view: t === "ALL" ? "table" : null });

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { INBOX: pendingInbox.length };
    for (const s of STAGES) counts[s.key] = (byStage.buckets.get(s.key) ?? []).length;
    return counts;
  }, [pendingInbox.length, byStage]);

  const activeTabKey = mode === "inbox" ? "INBOX" : mode === "board" ? "ALL" : tab;

  return (
    <PageShell width="wide" className="pipeline-page">
      <header>
        <h1 className="md-display-small-emphasized text-[var(--md-sys-color-on-surface)]">Pipeline</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
          <span>
            <span className="font-medium tabular-nums text-[var(--md-sys-color-on-surface)]">{applications.length}</span> tracked
          </span>
          {stats.avg != null && (
            <span>
              <span className="font-medium tabular-nums text-[var(--md-sys-color-on-surface)]">{stats.avg.toFixed(1)}</span> avg score
            </span>
          )}
          {stats.responseRate != null && (
            <span>
              <span className="font-medium tabular-nums text-[var(--md-sys-color-on-surface)]">{stats.responseRate}%</span> response rate
            </span>
          )}
          {stats.applyReady > 0 && (
            <button
              type="button"
              onClick={() => setParams({ tab: "EVALUATED", min: 4, view: null })}
              className="font-medium text-[var(--md-sys-color-primary)] transition-colors hover:underline"
            >
              {stats.applyReady} apply-ready →
            </button>
          )}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-1 border-b border-[var(--md-sys-color-outline-variant)]">
          {STAGE_TAB_ITEMS.map((item) => {
            const active = activeTabKey === item.key || (item.key !== "INBOX" && tab === item.key && mode === "table");
            const count = tabCounts[item.key] ?? 0;
            return (
              <button
                key={item.key}
                type="button"
                className="md3-tab"
                data-active={active ? "true" : "false"}
                onClick={() => (item.key === "INBOX" ? goInbox() : goTable(item.key))}
              >
                {item.label}
                {count > 0 && <span className="md3-tab-badge">{count}</span>}
              </button>
            );
          })}
        </div>
        {mode !== "inbox" && (
          <div className="md3-segmented" role="group" aria-label="Tracker view">
            <button
              type="button"
              className="md3-segmented-btn"
              data-active={mode === "board" ? "true" : "false"}
              onClick={goBoard}
            >
              <MaterialSymbol name="view_kanban" size={20} />
              Board
            </button>
            <button
              type="button"
              className="md3-segmented-btn"
              data-active={mode === "table" ? "true" : "false"}
              onClick={() => goTable("ALL")}
            >
              <MaterialSymbol name="table_rows" size={20} />
              Table
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 md3-actions-row">
        <Link href="/explore?run=1" className="md3-action-btn md3-action-btn--filled min-h-[56px] px-8">
          <span className="material-symbols-outlined text-[22px] leading-none">explore</span>
          <span className="md3-action-btn__label">Run free scan</span>
        </Link>
        <Link href="/add" className="md3-action-btn md3-action-btn--outlined">
          <span className="material-symbols-outlined text-[20px] leading-none">link</span>
          <span className="md3-action-btn__label">Add job link</span>
        </Link>
      </div>

      {mode === "inbox" && (
        <>
          <div className="mt-6">
            <JobLinkHub compact origin="/pipeline" />
          </div>
          {pendingInbox.length > 0 ? (
            <InboxTriage inbox={pendingInbox} />
          ) : (
            <EmptyPanel
              title={
                <>
                  Your <span className="text-[var(--md-sys-color-primary)]">inbox</span> is empty
                </>
              }
              body="Find roles that match your CV — free, no tokens spent."
              cta
            />
          )}
        </>
      )}

      {mode === "board" &&
        (applications.length === 0 ? (
          <EmptyPanel
            title="Nothing tracked yet"
            body="Evaluate a job URL or run a free scan — evaluated roles land here and flow left to right."
            cta
          />
        ) : (
          <div className="md3-pipeline-board mt-6">
            {STAGES.map((s) => (
              <BoardColumn
                key={s.key}
                label={s.label}
                stage={s.stage}
                rows={byStage.buckets.get(s.key) ?? []}
                onSeeAll={() => goTable(s.key)}
              />
            ))}
            <BoardColumn
              label="Closed"
              stage="closed"
              rows={byStage.closed}
              showStatus
              onSeeAll={() => goTable("ALL")}
            />
          </div>
        ))}

      {mode === "table" && (
        <div className="md3-pipeline-list-panel mt-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", ...CLOSED] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="md3-chip"
                  data-active={tab === t ? "true" : "false"}
                  onClick={() => setParams({ tab: t, view: t === "ALL" ? "table" : null, min: null })}
                >
                  {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
              {minFilter != null && (
                <button
                  type="button"
                  className="md3-chip"
                  data-active="true"
                  onClick={() => setParams({ min: null })}
                >
                  score ≥ {minFilter.toFixed(1)} ×
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="md-body-small tabular-nums text-[var(--md-sys-color-outline)]">
                {filtered.length} role{filtered.length === 1 ? "" : "s"}
              </span>
              <input
                type="search"
                placeholder="Search company or role…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-12 w-56 rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] px-4 md-body-medium text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] sm:w-64"
              />
            </div>
          </div>
          {filtered.length > 0 ? (
            <div>
              {filtered.map((row) => (
                <PipelineListRow key={row.n} row={row} />
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
              No matches — pick another stage or clear the search.
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function BoardColumn({
  label,
  stage,
  rows,
  showStatus = false,
  onSeeAll,
}: {
  label: string;
  stage: "evaluated" | "applied" | "responded" | "interview" | "offer" | "closed";
  rows: Application[];
  showStatus?: boolean;
  onSeeAll: () => void;
}) {
  const visible = rows.slice(0, BOARD_CAP);
  return (
    <section className="md3-pipeline-column" data-stage={stage}>
      <header className="md3-pipeline-column-header">
        <h2 className="md-column-heading">{label}</h2>
        <span className="md3-pipeline-column-count">{rows.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {visible.map((row) => (
          <BoardCard key={row.n} row={row} showStatus={showStatus} stage={stage} />
        ))}
        {rows.length === 0 && (
          <div className="rounded-[var(--md-sys-shape-corner-large-increased)] border border-dashed border-[var(--md-sys-color-outline-variant)] px-3 py-6 text-center md-body-small text-[var(--md-sys-color-outline)]">
            No roles here yet
          </div>
        )}
        {rows.length > BOARD_CAP && (
          <button type="button" onClick={onSeeAll} className="md3-btn-text w-full">
            See all {rows.length} in table
          </button>
        )}
      </div>
    </section>
  );
}

function BoardCard({
  row,
  showStatus,
  stage,
}: {
  row: Application;
  showStatus: boolean;
  stage: string;
}) {
  const hasScore = !!row.score && row.score.trim() !== "" && row.score.trim() !== "—";
  return (
    <div className="md3-pipeline-card group relative">
      <Link
        href={`/pipeline/${row.n}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open report for ${row.company}`}
      />
      <div className="relative z-[1] pointer-events-none">
        <div className="flex items-start gap-2.5">
          <CompanyLogo name={row.company} size={24} className="mt-px shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="block truncate md-title-small text-inherit">{row.company}</span>
            <p className="mt-0.5 line-clamp-2 md-body-medium opacity-80">{row.role}</p>
          </div>
          {hasScore && <ScoreBadge score={row.score} inverted={stage === "offer"} />}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--md-sys-color-outline-variant)] pt-2 opacity-70">
          <span className="min-w-0 truncate md-body-small tabular-nums">
            {showStatus ? (
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", statusDot(row.status))} />
                {row.status}
                {row.date ? ` · ${row.date}` : ""}
              </span>
            ) : (
              row.date || "—"
            )}
          </span>
          <span className="pointer-events-auto opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <PipelineRowActions n={row.n} company={row.company} role={row.role} />
          </span>
        </div>
      </div>
    </div>
  );
}

function PipelineListRow({ row }: { row: Application }) {
  return (
    <div className="md3-pipeline-list-row">
      <span aria-hidden className="size-[22px] rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline-variant)]" />
      <CompanyLogo name={row.company} size={40} />
      <div className="min-w-0">
        <Link href={`/pipeline/${row.n}`} className="block truncate md-title-small text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-primary)]">
          {row.company}
        </Link>
        <p className="truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">{row.role}</p>
      </div>
      <span className="hidden truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)] lg:block">—</span>
      <span className="hidden md-body-small text-[var(--md-sys-color-on-surface-variant)] xl:block">—</span>
      <span className="font-mono text-sm tabular-nums text-[var(--md-sys-color-outline)]">{row.date || "—"}</span>
      {row.score ? <ScoreBadge score={row.score} /> : <span />}
      <PipelineRowActions n={row.n} company={row.company} role={row.role} />
    </div>
  );
}

function ScoreBadge({ score, inverted = false }: { score: string; inverted?: boolean }) {
  const tone = scoreTone(score);
  const toneClass =
    tone === "good"
      ? inverted
        ? "bg-[var(--md-sys-color-on-primary)] text-[var(--md-sys-color-primary)]"
        : "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
      : tone === "warn"
        ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
        : tone === "bad"
          ? "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
          : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]";

  return <span className={cn("md3-score-badge", toneClass)}>{score}</span>;
}

function EmptyPanel({ title, body, cta = false }: { title: React.ReactNode; body: string; cta?: boolean }) {
  return (
    <div className="mt-6 overflow-hidden rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] px-8 py-16 text-center">
      <h2 className="md-headline-medium text-[var(--md-sys-color-on-surface)]">{title}</h2>
      <p className="mx-auto mt-3 max-w-md md-body-large text-[var(--md-sys-color-on-surface-variant)]">{body}</p>
      {cta && (
        <Link href="/explore?run=1" className="md3-action-btn md3-action-btn--filled mt-6 min-h-[56px] px-8">
          <span className="material-symbols-outlined text-[20px] leading-none">explore</span>
          <span className="md3-action-btn__label">Run a free scan</span>
        </Link>
      )}
    </div>
  );
}
