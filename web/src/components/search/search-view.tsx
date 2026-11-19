"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CompanyLogo } from "@/components/company-logo";
import { useJobs } from "@/components/jobs/job-store";
import { resolveCliIdForRun } from "@/lib/cli-config";
import { cn } from "@/lib/cn";
import type { JobStatus, SearchJob } from "@/lib/search/jobs";

type Tab = JobStatus;
type ScanState = { running: boolean; done: number; total: number; current: string; added: number; failed: number };
type AiState = { running: boolean; notes: string[]; added: number; error: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "New" },
  { id: "evaluated", label: "Evaluated" },
  { id: "dismissed", label: "Dismissed" },
];

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function shortDate(d: string): string {
  if (!d) return "—";
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
}

async function readNdjson(res: Response, onEvent: (e: Record<string, unknown>) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) try { onEvent(JSON.parse(line)); } catch { /* partial line */ }
    }
  }
}

function scoreClass(score?: string) {
  const n = Number.parseFloat(score ?? "");
  if (!Number.isFinite(n)) return "search-score--none";
  return n >= 4 ? "search-score--good" : n >= 3.5 ? "search-score--mid" : "search-score--low";
}

export function SearchView({ initialJobs, initialLastScan, initialSources }: { initialJobs: SearchJob[]; initialLastScan: string | null; initialSources: number }) {
  const { jobs: runs, startJob } = useJobs();
  const [items, setItems] = useState<SearchJob[] | null>(initialJobs);
  const [lastScan, setLastScan] = useState<string | null>(initialLastScan);
  const [sourceCount, setSourceCount] = useState(initialSources);
  const [tab, setTab] = useState<Tab>("new");
  const [filter, setFilter] = useState("");
  const [source, setSource] = useState("all");
  const [scan, setScan] = useState<ScanState>({ running: false, done: 0, total: 0, current: "", added: 0, failed: 0 });
  const [ai, setAi] = useState<AiState>({ running: false, notes: [], added: 0, error: "" });
  const [aiQuery, setAiQuery] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const aiAbort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/search", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { jobs: SearchJob[]; lastScan: string | null; sources: number };
    setItems(data.jobs);
    setLastScan(data.lastScan);
    setSourceCount(data.sources);
  }, []);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("co-job-done", refresh);
    return () => window.removeEventListener("co-job-done", refresh);
  }, [load]);

  async function runScan() {
    setMessage("");
    setScan({ running: true, done: 0, total: 0, current: "Starting…", added: 0, failed: 0 });
    try {
      const res = await fetch("/api/search/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Scan failed.");
      await readNdjson(res, (e) => {
        if (e.type === "start") setScan((s) => ({ ...s, total: Number(e.total) }));
        else if (e.type === "source") setScan((s) => ({ ...s, done: s.done + 1, current: String(e.label), failed: s.failed + (e.error ? 1 : 0) }));
        else if (e.type === "done") setScan((s) => ({ ...s, added: Number(e.added) }));
      });
      setTab("new");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setScan((s) => ({ ...s, running: false }));
    }
  }

  async function runAi() {
    const query = aiQuery.trim();
    const cliId = await resolveCliIdForRun();
    if (!cliId) { setMessage("Pick an AI engine in Settings first."); return; }
    setMessage("");
    const abort = new AbortController();
    aiAbort.current = abort;
    setAi({ running: true, notes: [], added: 0, error: "" });
    try {
      const res = await fetch("/api/search/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, cliId }), signal: abort.signal });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "AI search failed.");
      await readNdjson(res, (e) => {
        if (e.type === "note") setAi((s) => ({ ...s, notes: [...s.notes, String(e.text)].slice(-4) }));
        else if (e.type === "job") { setAi((s) => ({ ...s, added: s.added + 1 })); void load(); }
        else if (e.type === "error") setAi((s) => ({ ...s, error: String(e.msg) }));
      });
      setTab("new");
      await load();
    } catch (error) {
      if (!abort.signal.aborted) setAi((s) => ({ ...s, error: error instanceof Error ? error.message : "AI search failed." }));
    } finally {
      setAi((s) => ({ ...s, running: false }));
      aiAbort.current = null;
    }
  }

  function evaluate(url: string, company: string, role: string) {
    const id = startJob({ title: `Evaluate · ${company}`, subtitle: role, kind: "evaluate", input: url, page: "/explore" });
    if (!id) setMessage("Pick an AI engine in Settings first.");
  }

  function evaluateLink() {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) { setMessage("Paste a full job link starting with https://"); return; }
    evaluate(url, "pasted link", url);
    setLink("");
  }

  async function dismiss(key: string, dismissed: boolean) {
    setItems((list) => list?.map((j) => (j.key === key ? { ...j, status: dismissed ? "dismissed" : j.n ? "evaluated" : "new" } : j)) ?? null);
    await fetch("/api/search", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, dismissed }) });
  }

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { new: 0, evaluated: 0, dismissed: 0 };
    for (const j of items ?? []) c[j.status] += 1;
    return c;
  }, [items]);
  const sources = useMemo(() => [...new Set((items ?? []).map((j) => j.source))].sort(), [items]);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (items ?? [])
      .filter((j) => j.status === tab)
      .filter((j) => source === "all" || j.source === source)
      .filter((j) => !q || `${j.role} ${j.company} ${j.location}`.toLowerCase().includes(q))
      .sort((a, b) => tab === "evaluated" ? (Number.parseFloat(b.score ?? "0") || 0) - (Number.parseFloat(a.score ?? "0") || 0) : 0);
  }, [items, tab, source, filter]);
  const evaluating = useMemo(() => new Set(runs.filter((r) => r.kind === "evaluate" && r.status === "running").map((r) => r.input)), [runs]);

  return (
    <div className="search-page">
      <header className="search-head">
        <div>
          <h1 className="md-headline-medium">Search</h1>
          <p className="search-sub">
            {sourceCount} company boards and job boards from your sources · last scan {ago(lastScan)} ·{" "}
            <Link href="/portals" className="search-link">Manage sources</Link>
          </p>
        </div>
        <button type="button" className="md3-action-btn md3-action-btn--filled" onClick={runScan} disabled={scan.running}>
          <MaterialSymbol name={scan.running ? "progress_activity" : "radar"} size={18} className={scan.running ? "animate-spin" : undefined} />
          <span className="md3-action-btn__label">{scan.running ? "Scanning…" : "Scan job boards"}</span>
        </button>
      </header>

      <section className="search-tools">
        <form className="search-tool" onSubmit={(e) => { e.preventDefault(); void runAi(); }}>
          <MaterialSymbol name="auto_awesome" size={20} className="search-tool__icon" />
          <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Optional: what to look for (empty = your target roles)" aria-label="AI search" disabled={ai.running} />
          {ai.running ? (
            <button type="button" className="md3-action-btn md3-action-btn--outlined" onClick={() => aiAbort.current?.abort()}>Stop</button>
          ) : (
            <button type="submit" className="md3-action-btn md3-action-btn--outlined">Find jobs with AI</button>
          )}
        </form>
        <form className="search-tool" onSubmit={(e) => { e.preventDefault(); evaluateLink(); }}>
          <MaterialSymbol name="link" size={20} className="search-tool__icon" />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste any job link" aria-label="Job link" />
          <button type="submit" className="md3-action-btn md3-action-btn--outlined" disabled={!link.trim()}>Evaluate</button>
        </form>
      </section>

      <div className="search-slot">
      {!scan.running && scan.total === 0 && !ai.running && ai.notes.length === 0 && !ai.error && !message && (
        <p className="search-hint"><MaterialSymbol name="info" size={18} />Nothing runs until you click. Scan job boards is free; Find jobs with AI uses your AI engine.</p>
      )}
      {(scan.running || scan.total > 0) && (
        <div className="search-status" role="status">
          <div className="search-status__bar"><span style={{ width: `${scan.total ? Math.round((scan.done / scan.total) * 100) : 4}%` }} /></div>
          <span>
            {scan.running ? `Scanning ${scan.done}/${scan.total || "…"} · ${scan.current}` : `Scan finished: ${scan.added} new job${scan.added === 1 ? "" : "s"} from ${scan.total} sources${scan.failed ? ` (${scan.failed} unreachable)` : ""}.`}
          </span>
        </div>
      )}
      {(ai.running || ai.notes.length > 0 || ai.error) && (
        <div className="search-status" role="status">
          {ai.running && <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />}
          <span>{ai.error ? <span className="search-error">{ai.error}</span> : ai.running ? ai.notes.at(-1) ?? "Searching…" : `AI search finished: ${ai.added} new job${ai.added === 1 ? "" : "s"}.`}</span>
        </div>
      )}
      {message && <p className="search-error" role="alert">{message}</p>}
      </div>

      <div className="search-bar">
        <div className="search-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className="search-tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}<span className="search-tab__count">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="search-filters">
          <label className="search-filter">
            <MaterialSymbol name="filter_list" size={18} />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by role, company, location" aria-label="Filter jobs" />
          </label>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source" className="search-select">
            <option value="all">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="search-table" role="table" aria-label="Jobs">
        <div className="search-row search-row--head" role="row">
          <span role="columnheader">Role</span>
          <span role="columnheader">Location</span>
          <span role="columnheader">Source</span>
          <span role="columnheader">{tab === "evaluated" ? "Score" : "Found"}</span>
          <span role="columnheader" className="search-actions-col">Actions</span>
        </div>
        {items === null ? (
          <p className="search-empty">Loading jobs…</p>
        ) : visible.length === 0 ? (
          <p className="search-empty">
            {tab === "new" ? "No new jobs. Scan job boards or ask AI to search." : tab === "evaluated" ? "Nothing evaluated yet." : "Nothing dismissed."}
          </p>
        ) : (
          visible.map((j) => {
            const running = evaluating.has(j.url);
            return (
              <div key={j.key} className="search-row" role="row">
                <div className="search-role" role="cell">
                  <CompanyLogo name={j.company} size={36} />
                  <div className="min-w-0">
                    <a href={j.url} target="_blank" rel="noreferrer" className="search-role__title" title={j.role}>{j.role}</a>
                    <div className="search-role__company">
                      {j.company}
                      {j.kind === "hiring-signal" && <span className="search-chip search-chip--soft">hiring post</span>}
                    </div>
                    {j.why && <p className="search-role__why">{j.why}</p>}
                  </div>
                </div>
                <span role="cell" className="search-cell" title={j.location}>{j.location || "—"}</span>
                <span role="cell"><span className="search-chip">{j.source}</span></span>
                <span role="cell" className="search-cell">
                  {tab === "evaluated" ? (
                    <span className={cn("search-score", scoreClass(j.score))}>{j.score ?? "done"}</span>
                  ) : (
                    shortDate(j.postedAt || j.foundAt)
                  )}
                </span>
                <div role="cell" className="search-actions">
                  {j.status === "new" && (
                    <>
                      <button type="button" className="md3-action-btn md3-action-btn--filled search-btn" disabled={running} onClick={() => evaluate(j.url, j.company, j.role)}>
                        {running ? <MaterialSymbol name="progress_activity" size={16} className="animate-spin" /> : null}
                        <span className="md3-action-btn__label">{running ? "Evaluating" : "Evaluate"}</span>
                      </button>
                      <button type="button" className="search-icon-btn" title="Dismiss" aria-label={`Dismiss ${j.role}`} onClick={() => void dismiss(j.key, true)}>
                        <MaterialSymbol name="close" size={18} />
                      </button>
                    </>
                  )}
                  {j.status === "evaluated" && j.n && (
                    <Link href={`/apply?n=${j.n}`} className="md3-action-btn md3-action-btn--outlined search-btn">
                      <span className="md3-action-btn__label">{j.appStatus && j.appStatus !== "Evaluated" ? j.appStatus : "Apply"}</span>
                    </Link>
                  )}
                  {j.status === "dismissed" && (
                    <button type="button" className="md3-action-btn md3-action-btn--text search-btn" onClick={() => void dismiss(j.key, false)}>Restore</button>
                  )}
                  <a href={j.url} target="_blank" rel="noreferrer" className="search-icon-btn" title="Open posting" aria-label={`Open ${j.role} posting`}>
                    <MaterialSymbol name="open_in_new" size={18} />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
