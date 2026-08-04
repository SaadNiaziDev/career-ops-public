"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Table, Tag, Empty, Button } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import {
  CompassOutlined,
  CloseOutlined,
  LinkOutlined,
  ProjectOutlined,
  TableOutlined,
} from "@ant-design/icons";
import type { Application, InboxJob } from "@/lib/career-ops";
import { CompanyLogo } from "@/components/company-logo";
import { canonStatus, scoreNum, scoreTone, statusDot } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { InboxTriage } from "@/components/inbox/inbox-triage";
import { PipelineRowActions } from "@/components/pipeline/pipeline-row-actions";
import { PageShell } from "@/components/dossier/page-shell";
import { JobLinkHub } from "@/components/job-link-hub";
import { instrumentSerif } from "@/lib/fonts";
import { cn } from "@/lib/cn";

/* Active stages, in flow order — the funnel and the board share this. */
const STAGES = [
  { key: "EVALUATED", label: "Evaluated", dot: "bg-zinc-400", accent: "border-t-zinc-400" },
  { key: "APPLIED", label: "Applied", dot: "bg-sky-400", accent: "border-t-sky-400" },
  { key: "RESPONDED", label: "Responded", dot: "bg-sky-500", accent: "border-t-sky-500" },
  { key: "INTERVIEW", label: "Interview", dot: "bg-emerald-400", accent: "border-t-emerald-400" },
  { key: "OFFER", label: "Offer", dot: "bg-emerald-500", accent: "border-t-emerald-500" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

const CLOSED = ["REJECTED", "DISCARDED", "SKIP"] as const;

const TABS = ["INBOX", "ALL", ...STAGES.map((s) => s.key), ...CLOSED] as const;
type Tab = (typeof TABS)[number];

const SORT_KEYS = ["company", "role", "score", "status", "date"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const SCORE_TONE: Record<string, string> = {
  good: "success",
  warn: "warning",
  bad: "error",
  muted: "default",
};

const BOARD_CAP = 10;

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

  /* Rows bucketed by canonical stage — feeds the funnel counts AND the board. */
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

  const columns: ColumnsType<Application> = [
    {
      title: "Company",
      dataIndex: "company",
      sorter: true,
      sortOrder: sortKey === "company" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (company: string, row) => (
        <Link href={`/pipeline/${row.n}`} className="inline-flex items-center gap-2.5 font-medium hover:text-brand">
          <CompanyLogo name={company} size={24} />
          {company}
        </Link>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      sorter: true,
      sortOrder: sortKey === "role" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (role: string, row) => (
        <Link href={`/pipeline/${row.n}`} className="text-muted hover:text-brand">
          {role}
        </Link>
      ),
    },
    {
      title: "Score",
      dataIndex: "score",
      width: 96,
      sorter: true,
      sortOrder: sortKey === "score" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (score: string) => <Tag color={SCORE_TONE[scoreTone(score)]}>{score || "—"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: true,
      sortOrder: sortKey === "status" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (status: string) => (
        <span className="inline-flex items-center gap-2 text-muted">
          <span className={cn("size-2 shrink-0 rounded-full", statusDot(status))} />
          {status}
        </span>
      ),
    },
    {
      title: "Date",
      dataIndex: "date",
      width: 112,
      sorter: true,
      sortOrder: sortKey === "date" ? (sortDir === 1 ? "ascend" : "descend") : null,
      className: "tabular-nums text-faint",
    },
    {
      title: "",
      key: "actions",
      width: 56,
      render: (_, row) => <PipelineRowActions n={row.n} company={row.company} role={row.role} />,
    },
  ];

  const onTableChange: TableProps<Application>["onChange"] = (_pag, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const col = (s?.columnKey ?? s?.field) as SortKey | undefined;
    if (!col || !(SORT_KEYS as readonly string[]).includes(col)) return;
    const dir = s?.order === "ascend" ? 1 : -1;
    setParams({ sort: col, dir });
  };

  const goInbox = () => setParams({ tab: null, view: null, min: null });
  const goBoard = () => setParams({ tab: "ALL", view: null, min: null });
  const goTable = (t: Tab = "ALL") => setParams({ tab: t, view: t === "ALL" ? "table" : null });

  return (
    <PageShell width="wide" className="pipeline-page">
      {/* ── Command header — compact, no hero ─────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Job search dossier</p>
          <h1 className={cn(instrumentSerif.className, "mt-1.5 text-3xl tracking-tight text-landing sm:text-4xl")}>
            Pipeline
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              <span className="font-medium tabular-nums text-foreground">{applications.length}</span> tracked
            </span>
            {stats.avg != null && (
              <span>
                <span className="font-medium tabular-nums text-foreground">{stats.avg.toFixed(1)}</span> avg score
              </span>
            )}
            {stats.responseRate != null && (
              <span>
                <span className="font-medium tabular-nums text-foreground">{stats.responseRate}%</span> response rate
              </span>
            )}
            {stats.applyReady > 0 && (
              <button
                type="button"
                onClick={() => setParams({ tab: "EVALUATED", min: 4, view: null })}
                className="font-medium text-brand-text transition-colors hover:underline"
              >
                {stats.applyReady} apply-ready →
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/explore?run=1">
            <Button type="primary" icon={<CompassOutlined />}>
              Run free scan
            </Button>
          </Link>
          <Link href="/add">
            <Button icon={<LinkOutlined />}>Add job link</Button>
          </Link>
        </div>
      </header>

      {/* ── The funnel — the pipeline drawn as a pipeline ─────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="funnel-scroll min-w-0 flex-1 overflow-x-auto">
          <div className="funnel">
            <FunnelSeg
              first
              active={mode === "inbox"}
              count={pendingInbox.length}
              label="Inbox"
              dot="bg-brand"
              onClick={goInbox}
            />
            {STAGES.map((s) => (
              <FunnelSeg
                key={s.key}
                active={mode === "table" && tab === s.key}
                count={(byStage.buckets.get(s.key) ?? []).length}
                label={s.label}
                dot={s.dot}
                onClick={() => goTable(s.key)}
              />
            ))}
          </div>
        </div>
        {mode !== "inbox" && (
          <div className="inline-flex shrink-0 rounded-xl border border-border bg-surface p-1" role="group" aria-label="Tracker view">
            <ViewToggle active={mode === "board"} onClick={goBoard} icon={<ProjectOutlined />} label="Board" />
            <ViewToggle active={mode === "table"} onClick={() => goTable("ALL")} icon={<TableOutlined />} label="Table" />
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
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
                  Your <span className="text-brand">inbox</span> is empty
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
          <div className="mt-5 flex gap-3.5 overflow-x-auto pb-3 2xl:grid 2xl:grid-cols-6 2xl:overflow-visible">
            {STAGES.map((s) => (
              <BoardColumn
                key={s.key}
                label={s.label}
                dot={s.dot}
                accent={s.accent}
                rows={byStage.buckets.get(s.key) ?? []}
                onSeeAll={() => goTable(s.key)}
              />
            ))}
            <BoardColumn
              label="Closed"
              dot="bg-zinc-600"
              accent="border-t-zinc-600"
              rows={byStage.closed}
              showStatus
              muted
              onSeeAll={() => goTable("ALL")}
            />
          </div>
        ))}

      {mode === "table" && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface/50">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", ...CLOSED] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setParams({ tab: t, view: t === "ALL" ? "table" : null, min: null })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === t
                      ? "border-brand/40 bg-brand-soft text-brand-text"
                      : "border-border text-muted hover:border-brand/30 hover:text-foreground",
                  )}
                >
                  {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
              {minFilter != null && (
                <Tag closable onClose={() => setParams({ min: null })} closeIcon={<CloseOutlined />} color="processing" className="ml-1">
                  score ≥ {minFilter.toFixed(1)}
                </Tag>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs tabular-nums text-faint">
                {filtered.length} role{filtered.length === 1 ? "" : "s"}
              </span>
              <Input.Search
                allowClear
                placeholder="Search company or role…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-56 sm:w-64"
              />
            </div>
          </div>
          {filtered.length > 0 ? (
            <Table
              rowKey={(r) => r.n}
              columns={columns}
              dataSource={filtered}
              pagination={{ pageSize: 25, showSizeChanger: false, className: "px-4 sm:px-5 pb-4" }}
              onChange={onTableChange}
              size="middle"
              className="pipeline-table"
            />
          ) : (
            <div className="px-6 py-16">
              <Empty description="No matches — pick another stage or clear the search." />
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

/* ── Funnel segment — chevron-linked stage with count ──────────────────── */
function FunnelSeg({
  first = false,
  active,
  count,
  label,
  dot,
  onClick,
}: {
  first?: boolean;
  active: boolean;
  count: number;
  label: string;
  dot: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "funnel-seg text-left transition-colors focus-visible:outline-none",
        first && "funnel-seg-first",
        active
          ? "bg-brand-soft text-brand-text"
          : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground",
        count === 0 && !active && "opacity-60",
      )}
    >
      <span className="block text-xl font-semibold tabular-nums leading-none tracking-tight">{count}</span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        <span className="truncate text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </span>
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-brand text-brand-foreground shadow-sm" : "text-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Board column — one stage, cards sorted by score ───────────────────── */
function BoardColumn({
  label,
  dot,
  accent,
  rows,
  showStatus = false,
  muted = false,
  onSeeAll,
}: {
  label: string;
  dot: string;
  accent: string;
  rows: Application[];
  showStatus?: boolean;
  muted?: boolean;
  onSeeAll: () => void;
}) {
  const visible = rows.slice(0, BOARD_CAP);
  return (
    <section
      className={cn(
        "flex w-70 shrink-0 flex-col self-start rounded-2xl border border-border border-t-2 bg-surface/40 2xl:w-auto 2xl:min-w-0",
        accent,
        muted && "opacity-80",
      )}
    >
      <header className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">{label}</h2>
        <span className="ml-auto rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">
          {rows.length}
        </span>
      </header>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {visible.map((row) => (
          <BoardCard key={row.n} row={row} showStatus={showStatus} />
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-xs text-faint">
            No roles here yet
          </div>
        )}
        {rows.length > BOARD_CAP && (
          <button
            type="button"
            onClick={onSeeAll}
            className="rounded-xl border border-border/80 py-2 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand"
          >
            See all {rows.length} in table
          </button>
        )}
      </div>
    </section>
  );
}

function BoardCard({ row, showStatus }: { row: Application; showStatus: boolean }) {
  const hasScore = !!row.score && row.score.trim() !== "" && row.score.trim() !== "—";
  return (
    <article className="group rounded-xl border border-border bg-surface p-3 transition-all duration-150 hover:border-brand/40 hover:shadow-sm">
      <div className="flex items-start gap-2.5">
        <CompanyLogo name={row.company} size={22} className="mt-px shrink-0" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/pipeline/${row.n}`}
            className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-brand"
          >
            {row.company}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{row.role}</p>
        </div>
        {hasScore && <Badge tone={scoreTone(row.score)}>{row.score}</Badge>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className="min-w-0 truncate text-[11px] tabular-nums text-faint">
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
        <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <PipelineRowActions n={row.n} company={row.company} role={row.role} />
        </span>
      </div>
    </article>
  );
}

/* ── Shared empty state ─────────────────────────────────────────────────── */
function EmptyPanel({ title, body, cta = false }: { title: React.ReactNode; body: string; cta?: boolean }) {
  return (
    <div className="dot-bg mt-5 overflow-hidden rounded-2xl border border-brand/25 bg-linear-to-tr from-brand/10 via-transparent to-transparent">
      <div className="px-8 py-16 text-center">
        <h2 className={cn(instrumentSerif.className, "text-2xl tracking-tight text-landing sm:text-3xl")}>{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">{body}</p>
        {cta && (
          <Link href="/explore?run=1" className="mt-6 inline-block">
            <Button type="primary" size="large" icon={<CompassOutlined />}>
              Run a free scan
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
