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
import { Md3Input } from "@/components/ui/md3-input";
import { Md3Select } from "@/components/ui/md3-select";
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
const DATE_WINDOWS = [7, 30, 90] as const;

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
  const pDays = parseInt(params.get("days") ?? "", 10);
  const daysFilter: number | null = (DATE_WINDOWS as readonly number[]).includes(pDays) ? pDays : null;
  const locationFilter = params.get("location") ?? "";
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
    if (daysFilter != null) rows = rows.filter((r) => isWithinDays(r.date, daysFilter));
    if (locationFilter.trim()) {
      const locationNeedle = locationFilter.trim().toLowerCase();
      rows = rows.filter((r) => applicationLocationText(r).includes(locationNeedle));
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => `${r.company} ${r.role} ${r.location ?? ""}`.toLowerCase().includes(needle));
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
  }, [applications, mode, tab, q, sortKey, sortDir, minFilter, daysFilter, locationFilter]);

  const goInbox = () => setParams({ tab: null, view: null, min: null });
  const goBoard = () => setParams({ tab: "ALL", view: null, min: null });
  const goTable = (t: Tab = "ALL") => setParams({ tab: t, view: t === "ALL" ? "table" : null });

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { INBOX: pendingInbox.length };
    for (const s of STAGES) counts[s.key] = (byStage.buckets.get(s.key) ?? []).length;
    return counts;
  }, [pendingInbox.length, byStage]);

  const activeTabKey = mode === "inbox" ? "INBOX" : mode === "board" ? "ALL" : tab;
  const hasTableFilters = minFilter != null || daysFilter != null || locationFilter.trim() !== "" || q.trim() !== "";

  const clearTableFilters = () => {
    setQ("");
    setParams({ q: null, min: null, days: null, location: null });
  };

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4" data-co-tour="pipeline-tabs">
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
            <div data-co-tour="pipeline-inbox">
            <InboxTriage inbox={pendingInbox} />
            </div>
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
          <div className="md3-pipeline-board mt-6" data-co-tour="pipeline-board">
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
          <div className="border-b border-[var(--md-sys-color-outline-variant)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["ALL", ...CLOSED] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="md3-chip"
                  data-active={tab === t ? "true" : "false"}
                  onClick={() => setParams({ tab: t, view: t === "ALL" ? "table" : null })}
                >
                  {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
              <span className="ml-auto md-body-small tabular-nums text-[var(--md-sys-color-outline)]" aria-live="polite">
                <strong className="font-semibold text-[var(--md-sys-color-on-surface)]">{filtered.length}</strong> of {applications.length} roles
              </span>
            </div>

            <div className="pipeline-filter-grid mt-4">
              <div className="pipeline-filter-field pipeline-filter-field--search">
                <span>Search</span>
                <Md3Input
                  icon="search"
                  type="search"
                  placeholder="Company or role"
                  aria-label="Search tracked roles"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="min-h-10"
                />
              </div>
              <div className="pipeline-filter-field">
                <span>Date evaluated</span>
                <Md3Select
                  value={daysFilter == null ? "any" : String(daysFilter)}
                  onChange={(value) => setParams({ days: value === "any" ? null : value })}
                  options={[
                    { value: "any", label: "Any date" },
                    { value: "7", label: "Last 7 days" },
                    { value: "30", label: "Last 30 days" },
                    { value: "90", label: "Last 90 days" },
                  ]}
                  aria-label="Date evaluated"
                />
              </div>
              <div className="pipeline-filter-field">
                <span>Minimum score</span>
                <Md3Select
                  value={minFilter == null ? "any" : String(minFilter)}
                  onChange={(value) => setParams({ min: value === "any" ? null : value })}
                  options={[
                    { value: "any", label: "Any score" },
                    { value: "4", label: "4.0+ / 5" },
                    { value: "3.5", label: "3.5+ / 5" },
                    { value: "3", label: "3.0+ / 5" },
                  ]}
                  aria-label="Minimum evaluation score"
                />
              </div>
              <div className="pipeline-filter-field">
                <span>Location</span>
                <Md3Input
                  icon="location_on"
                  placeholder="Lahore, remote…"
                  aria-label="Filter tracked roles by location"
                  value={locationFilter}
                  onChange={(e) => setParams({ location: e.target.value || null })}
                  className="min-h-10"
                />
              </div>
              <div className="pipeline-filter-field">
                <span>Sort by</span>
                <Md3Select
                  value={`${sortKey}-${sortDir === 1 ? "asc" : "desc"}`}
                  onChange={(value) => {
                    const [sort, dir] = value.split("-");
                    setParams({ sort, dir: dir === "asc" ? 1 : null });
                  }}
                  options={[
                    { value: "score-desc", label: "Highest score" },
                    { value: "date-desc", label: "Newest evaluated" },
                    { value: "company-asc", label: "Company A–Z" },
                    { value: "role-asc", label: "Role A–Z" },
                  ]}
                  aria-label="Sort tracked roles"
                />
              </div>
              {hasTableFilters && (
                <button type="button" onClick={clearTableFilters} className="md3-btn-text self-end justify-self-start">
                  <MaterialSymbol name="filter_alt_off" size={18} /> Clear filters
                </button>
              )}
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
              No matches. Adjust the filters or clear them to see all roles.
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
  const href = `/pipeline/${row.n}`;
  return (
    <div className="md3-pipeline-card group relative">
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open report for ${row.company}`}
      >
        <span className="sr-only">Open report for {row.company}</span>
      </Link>
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
          <span className="pointer-events-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${row.company} posting`}
                className="inline-flex size-8 items-center justify-center rounded-[var(--md-sys-shape-corner-full)] text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-on-surface)]"
                onClick={(e) => e.stopPropagation()}
              >
                <MaterialSymbol name="open_in_new" size={16} />
              </a>
            ) : null}
            <PipelineRowActions n={row.n} company={row.company} role={row.role} />
          </span>
        </div>
      </div>
    </div>
  );
}

function PipelineListRow({ row }: { row: Application }) {
  const location = applicationLocationLabel(row);
  const href = `/pipeline/${row.n}`;
  return (
    <div className="md3-pipeline-list-row group relative">
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open report for ${row.company}`}
      >
        <span className="sr-only">Open report for {row.company}</span>
      </Link>
      <span aria-hidden className="pointer-events-none relative z-[1] size-[22px] rounded-[var(--md-sys-shape-corner-extra-small)] border border-[var(--md-sys-color-outline-variant)]" />
      <CompanyLogo name={row.company} size={40} className="pointer-events-none relative z-[1]" />
      <div className="pointer-events-none relative z-[1] min-w-0">
        <span className="block truncate md-title-small text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)]">
          {row.company}
        </span>
        <p className="flex items-center gap-1 truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
          <span className="truncate">{row.role}</span>
        </p>
      </div>
      <span className="pointer-events-none relative z-[1] hidden truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)] lg:block">{location}</span>
      <span className="pointer-events-none relative z-[1] hidden items-center gap-1.5 md-body-small text-[var(--md-sys-color-on-surface-variant)] xl:flex">
        <span className={cn("size-1.5 shrink-0 rounded-full", statusDot(row.status))} />
        {row.status}
      </span>
      <span className="pointer-events-none relative z-[1] font-mono text-sm tabular-nums text-[var(--md-sys-color-outline)]">{row.date || "—"}</span>
      <span className="pointer-events-none relative z-[1]">{row.score ? <ScoreBadge score={row.score} /> : null}</span>
      <span className="relative z-[1] flex items-center gap-1">
        {row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${row.company} posting`}
            className="inline-flex size-8 items-center justify-center rounded-[var(--md-sys-shape-corner-full)] text-[var(--md-sys-color-outline)] opacity-0 transition-opacity hover:text-[var(--md-sys-color-on-surface)] group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MaterialSymbol name="open_in_new" size={16} />
          </a>
        ) : null}
        <PipelineRowActions n={row.n} company={row.company} role={row.role} />
      </span>
    </div>
  );
}

function applicationLocationText(row: Application): string {
  return `${row.location ?? ""} ${row.notes} ${row.role}`.toLowerCase();
}

function applicationLocationLabel(row: Application): string {
  const text = applicationLocationText(row);
  const mode = text.includes("remote") ? "Remote" : text.includes("onsite") || text.includes("on-site") ? "On-site" : "";
  const place = text.includes("lahore")
    ? "Lahore"
    : text.includes("islamabad")
      ? "Islamabad"
      : text.includes("karachi")
        ? "Karachi"
        : text.includes("united states") || text.includes("usa")
          ? "USA"
          : text.includes("pakistan")
            ? "Pakistan"
            : "";
  const summary = [mode, place].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ");
  if (summary) return summary;
  const explicit = row.location?.trim();
  return explicit && explicit.length <= 40 ? explicit : "—";
}

function isWithinDays(date: string, days: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(value)) return false;
  return Date.now() - value <= days * 86_400_000;
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
