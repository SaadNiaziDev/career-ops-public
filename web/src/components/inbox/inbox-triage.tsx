"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { useJobs } from "@/components/jobs/job-store";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { InboxJob } from "@/lib/career-ops";
import type { AtsSource } from "@/lib/explore";
import { ATS_SOURCES } from "@/lib/explore";
import { daysSince, seniorityFromTitle, sourceFromUrl, SENIORITY_ORDER, type Seniority } from "@/lib/inbox";
import { jobDestinationHref } from "@/components/jobs/job-utils";
import { FacetChips, type InboxSort } from "./facet-chips";
import { TriageRow, type RowScore } from "./triage-row";
import { ShortlistTray, type ShortItem } from "./shortlist-tray";
import { cn } from "@/lib/cn";

const SHORTLIST_KEY = "career-ops:shortlist";
const HIDDEN_KEY = "career-ops:hidden";
const CONFIG_KEY = "career-ops:config";
const BATCH = 20;

// The inbox as a TRIAGE surface: Abundance → Triage → Shortlist → Opt-in Score.
// Default is a small fresh batch (never the full wall); free facets + Save/Skip narrow
// it; only "Score shortlist" spends tokens. 🔴 The shell is agnostic to what makes a
// role relevant — order is freshness with a single documented plug point.
export function InboxTriage({ inbox }: { inbox: InboxJob[] }) {
  const { jobs, startJob } = useJobs();
  const { applications } = usePipeline();
  const { toast } = useToast();

  // facets
  const [within, setWithin] = useState<number | null>(null);
  const [minFit, setMinFit] = useState<number | null>(null);
  const [sources, setSources] = useState<Set<AtsSource>>(() => new Set());
  const [seniorities, setSeniorities] = useState<Set<Seniority>>(() => new Set());
  const [locQ, setLocQ] = useState("");
  const [kw, setKw] = useState("");
  const [sort, setSort] = useState<InboxSort>("newest");
  const [showAll, setShowAll] = useState(false);

  // persisted triage state + ephemeral selection/undo
  const [shortlist, setShortlist] = useState<ShortItem[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [hasCli, setHasCli] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SHORTLIST_KEY);
      if (s) setShortlist(JSON.parse(s));
      const h = localStorage.getItem(HIDDEN_KEY);
      if (h) setHidden(JSON.parse(h));
      const c = localStorage.getItem(CONFIG_KEY);
      setHasCli(!!(c && JSON.parse(c).cliId));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist)); } catch { /* quota */ }
  }, [shortlist, loaded]);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); } catch { /* quota */ }
  }, [hidden, loaded]);

  // stable "now" for freshness (per mount)
  const now = useMemo(() => Date.now(), []);

  // Dedupe by URL — pipeline.md can list the same posting twice; it's one job, so it
  // triages once (and Save/Skip/score, all keyed by URL, act on it coherently).
  const enriched = useMemo(() => {
    const seen = new Set<string>();
    const out: { job: InboxJob; source: AtsSource | null; seniority: Seniority | null; age: number | null }[] = [];
    for (const job of inbox) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      out.push({ job, source: sourceFromUrl(job.url), seniority: seniorityFromTitle(job.role), age: daysSince(job.postedAt, now) });
    }
    return out;
  }, [inbox, now]);

  // EVALUADA lookup: the latest evaluate worker per posting URL (running → badge).
  const scoreByUrl = useMemo(() => {
    const best = new Map<string, (typeof jobs)[number]>();
    for (const j of jobs) {
      if (!j.input || j.kind !== "evaluate") continue;
      const ex = best.get(j.input);
      if (!ex || j.startedAt > ex.startedAt) best.set(j.input, j);
    }
    const m = new Map<string, RowScore>();
    for (const [url, j] of best) {
      m.set(url, {
        score: j.result?.score ?? null,
        tone: j.result?.tone ?? "muted",
        jobId: j.id,
        running: j.status === "running",
        href: jobDestinationHref(j, applications),
      });
    }
    return m;
  }, [jobs, applications]);

  // facet options — only surface what's actually present in the (non-hidden) data
  const availSources = useMemo(() => {
    const set = new Set<AtsSource>();
    for (const e of enriched) if (e.source && !hidden.includes(e.job.url)) set.add(e.source);
    return ATS_SOURCES.filter((s) => set.has(s));
  }, [enriched, hidden]);
  const availSeniorities = useMemo(() => {
    const set = new Set<Seniority>();
    for (const e of enriched) if (e.seniority && !hidden.includes(e.job.url)) set.add(e.seniority);
    return SENIORITY_ORDER.filter((s) => set.has(s));
  }, [enriched, hidden]);

  const filtered = useMemo(
    () =>
      enriched.filter((e) => {
        if (hidden.includes(e.job.url)) return false;
        if (within != null && (e.age == null || e.age > within)) return false;
        if (minFit != null && (e.job.fitScore == null || e.job.fitScore < minFit)) return false;
        if (sources.size && (!e.source || !sources.has(e.source))) return false;
        if (seniorities.size && (!e.seniority || !seniorities.has(e.seniority))) return false;
        if (locQ.trim() && !(e.job.location || "").toLowerCase().includes(locQ.trim().toLowerCase())) return false;
        if (kw.trim() && !`${e.job.company} ${e.job.role}`.toLowerCase().includes(kw.trim().toLowerCase())) return false;
        return true;
      }),
    [enriched, hidden, within, minFit, sources, seniorities, locQ, kw],
  );

  // Free ordering uses only scanner metadata; no AI evaluation is implied here.
  const ordered = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort === "fit") return (b.job.fitScore ?? -Infinity) - (a.job.fitScore ?? -Infinity);
        if (sort === "company") return a.job.company.localeCompare(b.job.company);
        return (a.age ?? Infinity) - (b.age ?? Infinity);
      }),
    [filtered, sort],
  );

  const anyFacet = within != null || minFit != null || sources.size > 0 || seniorities.size > 0 || locQ.trim() !== "" || kw.trim() !== "";
  const capped = !showAll && !anyFacet;
  const visible = capped ? ordered.slice(0, BATCH) : ordered;
  const hiddenCount = hidden.length;

  const isShortlisted = (url: string) => shortlist.some((s) => s.url === url);

  const save = (job: InboxJob) => {
    if (isShortlisted(job.url)) return;
    setShortlist((s) => [...s, { url: job.url, company: job.company, role: job.role }]);
  };
  const skip = (job: InboxJob) => {
    setHidden((h) => (h.includes(job.url) ? h : [...h, job.url]));
    toast({
      message: `Skipped ${job.company}`,
      tone: "neutral",
      action: {
        label: "Undo",
        onClick: () => setHidden((h) => h.filter((u) => u !== job.url)),
      },
    });
  };
  const toggleSelect = (url: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(url)) n.delete(url);
      else n.add(url);
      return n;
    });
  const saveSelected = () => {
    const add = enriched
      .filter((e) => selected.has(e.job.url) && !isShortlisted(e.job.url))
      .map((e) => ({ url: e.job.url, company: e.job.company, role: e.job.role }));
    if (add.length) setShortlist((s) => [...s, ...add]);
    setSelected(new Set());
  };

  const estimate = useMemo(() => {
    const samples = jobs.filter((j) => j.kind === "evaluate" && j.status === "done" && j.cost?.tokens).map((j) => j.cost!);
    if (!samples.length || shortlist.length === 0) return {};
    const avgT = samples.reduce((a, c) => a + c.tokens, 0) / samples.length;
    const usds = samples.filter((s) => s.usd != null).map((s) => s.usd!);
    const avgUsd = usds.length ? usds.reduce((a, c) => a + c, 0) / usds.length : undefined;
    return { tokens: Math.round(avgT * shortlist.length), usd: avgUsd != null ? +(avgUsd * shortlist.length).toFixed(2) : undefined };
  }, [jobs, shortlist.length]);

  const scoreShortlist = () => {
    const batchId = `shortlist-${Date.now()}`;
    for (const it of shortlist) {
      startJob({ title: `Score · ${it.company}`, subtitle: it.role, kind: "evaluate", input: it.url, page: "/pipeline", batchId });
    }
    setShortlist([]); // sent — the rows flip to Scoring… → badge via scoreByUrl
  };

  // The parent (PipelineView) renders the rich empty-inbox card; here we always
  // have ≥1 raw posting.
  if (inbox.length === 0) return null;

  const activeFilterLabel =
    within != null
      ? `${within}d freshness`
      : minFit != null
        ? `${minFit}+ scanner fit`
        : sources.size === 1
        ? Array.from(sources)[0]
        : seniorities.size === 1
          ? Array.from(seniorities)[0]
          : locQ.trim()
            ? `location "${locQ.trim()}"`
            : kw.trim()
              ? `keyword "${kw.trim()}"`
              : null;

  return (
    <div className={cn("pipeline-inbox mt-6", shortlist.length > 0 && "pb-28")}>
      <FacetChips
          within={within}
          setWithin={setWithin}
          minFit={minFit}
          setMinFit={setMinFit}
          sources={sources}
          toggleSource={(s) => setSources((set) => { const n = new Set(set); n.has(s) ? n.delete(s) : n.add(s); return n; })}
          seniorities={seniorities}
          toggleSeniority={(s) => setSeniorities((set) => { const n = new Set(set); n.has(s) ? n.delete(s) : n.add(s); return n; })}
          locQ={locQ}
          setLocQ={setLocQ}
          kw={kw}
          setKw={setKw}
          sort={sort}
          setSort={setSort}
          availSources={availSources}
          availSeniorities={availSeniorities}
          resultCount={filtered.length}
          totalCount={enriched.length - hiddenCount}
          anyActive={anyFacet}
          onClear={() => { setWithin(null); setMinFit(null); setSources(new Set()); setSeniorities(new Set()); setLocQ(""); setKw(""); }}
        />

      {selected.size > 0 && (
        <header className="mt-4 flex min-h-[72px] flex-wrap items-center gap-3 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-secondary-container)] px-5">
          <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="text-[var(--md-sys-color-on-secondary-container)]">
            <MaterialSymbol name="close" size={24} />
          </button>
          <h2 className="text-xl font-medium tabular-nums text-[var(--md-sys-color-on-secondary-container)]">{selected.size} selected</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={saveSelected} className="md3-btn-filled min-h-10 px-4 text-sm">
              Save to shortlist
            </button>
          </div>
        </header>
      )}

      <div className="md3-pipeline-list-panel mt-4">
        {visible.length > 0 ? (
          visible.map((e) => (
            <TriageRow
              key={e.job.url}
              job={e.job}
              source={e.source}
              age={e.age}
              scored={scoreByUrl.get(e.job.url)}
              selected={selected.has(e.job.url)}
              shortlisted={isShortlisted(e.job.url)}
              onToggleSelect={() => toggleSelect(e.job.url)}
              onSave={() => save(e.job)}
              onSkip={() => skip(e.job)}
            />
          ))
        ) : (
          <div className="px-6 py-14 text-center">
            <p className="md-title-large text-[var(--md-sys-color-on-surface)]">No matches with current filters</p>
            {activeFilterLabel && anyFacet ? (
              <>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  Drop <strong>{activeFilterLabel}</strong> to bring back {enriched.length - hiddenCount} roles.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (within != null) setWithin(null);
                      else if (minFit != null) setMinFit(null);
                      else if (sources.size) setSources(new Set());
                      else if (seniorities.size) setSeniorities(new Set());
                      else if (locQ.trim()) setLocQ("");
                      else if (kw.trim()) setKw("");
                    }}
                    className="md3-btn-filled min-h-10"
                  >
                    Drop {activeFilterLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setWithin(null); setMinFit(null); setSources(new Set()); setSeniorities(new Set()); setLocQ(""); setKw(""); }}
                    className="md3-btn-outlined min-h-10"
                  >
                    Clear all filters
                  </button>
                </div>
              </>
            ) : (
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--md-sys-color-on-surface-variant)]">
                Loosen the filters above to see more of your inbox.
              </p>
            )}
          </div>
        )}

        {visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--md-sys-color-outline-variant)] px-6 py-4">
            <span className="text-[13px] text-[var(--md-sys-color-outline)]">
              {shortlist.length > 0
                ? `Not scored yet — scoring ${shortlist.length} saved spends tokens`
                : "Save roles worth a look, then score them together — one token spend."}
            </span>
            {hiddenCount > 0 && (
              <button type="button" onClick={() => setHidden([])} className="md3-btn-text text-sm">
                Restore {hiddenCount} hidden
              </button>
            )}
          </div>
        )}
      </div>

      {capped && ordered.length > BATCH && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-4 w-full md3-btn-outlined min-h-11">
          See all {ordered.length} in inbox
        </button>
      )}

      <ShortlistTray
        items={shortlist}
        estimate={estimate}
        hasCli={hasCli}
        onRemove={(url) => setShortlist((s) => s.filter((x) => x.url !== url))}
        onClear={() => setShortlist([])}
        onScore={scoreShortlist}
      />
    </div>
  );
}
