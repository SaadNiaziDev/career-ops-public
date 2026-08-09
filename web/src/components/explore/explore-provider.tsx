"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_FILTERS,
  ATS_LABEL,
  filtersToParams,
  aiToParams,
  isBroadSearch,
  paramsToAi,
  parseExplorePatch,
  type AtsSource,
  type DiscoveredOffer,
  type ExploreFilters,
  type ExploreMode,
  type ScanEvent,
} from "@/lib/explore";
import { makeAiStreamParser, type AiTraceChunk } from "@/lib/explore-ai";
import { readCliConfig, resolveCliIdForRun } from "@/lib/cli-config";

export type Phase =
  | "idle"
  | "casting"
  | "scanning"
  | "revealing"
  | "results"
  | "empty-current"
  | "empty-loose"
  | "failed"
  | "degraded" // scan completed but searched nothing (transient fetch/rate-limit) — not "all caught up"
  | "hunting" // AI search streaming
  | "blocked"; // AI search needs a CLI
export type AiCost = { searches: number; candidates: number; fetches: number };
export type SourceState = {
  state: "queued" | "active" | "swept" | "noisy";
  companies?: number;
  done?: number;
  total?: number;
  matches?: number;
  unreachable?: number;
};

type ExploreCtx = {
  filters: ExploreFilters;
  setFilters: (f: ExploreFilters) => void;
  /** Set filters from a seed/URL only if the user/assistant hasn't touched them
   *  yet — so a fresh page mount can't clobber assistant-set filters. */
  initFilters: (f: ExploreFilters) => void;
  phase: Phase;
  running: boolean;
  offers: DiscoveredOffer[];
  sources: Partial<Record<AtsSource, SourceState>>;
  matchCount: number;
  companiesScanned: number;
  companiesAvailable: number;
  capHit: boolean;
  droppedNoDate: number;
  status: string;
  partial: boolean;
  error: string;
  added: Set<string>;
  adding: Set<string>;
  discover: () => Promise<void>;
  addToPipeline: (offers: DiscoveredOffer[]) => Promise<number>;
  applyPatch: (raw: Record<string, unknown>, opts?: { merge?: boolean; run?: boolean }) => void;
  reset: () => void;
  // ── AI search (modes/discover.md) ──
  mode: ExploreMode;
  setMode: (m: ExploreMode) => void;
  /** Which surface produced the current result set — a tab shows results only
   *  when this matches its own mode, so Scan never displays AI hits (or vice versa). */
  resultsMode: ExploreMode;
  aiIntent: string;
  setAiIntent: (s: string) => void;
  /** Optional intent override — use when starting from a URL before state flushes. */
  discoverAI: (intentOverride?: string) => Promise<void>;
  aiTrace: AiTraceChunk[];
  aiCost: AiCost;
};

const Ctx = createContext<ExploreCtx | null>(null);
export function useExplore(): ExploreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useExplore must be used within <ExploreProvider>");
  return c;
}

// Explore results are expensive (a scan walks the ATS network; an AI search spends
// tokens). Persist the SETTLED result set per-tab so a reload or a mode toggle never
// throws the work away (disc#5 — "came back to explore, work is lost").
const RESULTS_KEY = "career-ops:explore-results";
type ResultSnapshot = {
  v: number;
  mode: ExploreMode;
  phase: Phase;
  offers: DiscoveredOffer[];
  matchCount: number;
  companiesScanned: number;
  companiesAvailable: number;
  capHit: boolean;
  droppedNoDate: number;
  sources: Partial<Record<AtsSource, SourceState>>;
  partial: boolean;
  status: string;
  error: string;
  added: string[];
  aiTrace: AiTraceChunk[];
  aiCost: AiCost;
  aiIntent: string;
};

const SETTLED = new Set<Phase>(["results", "empty-current", "empty-loose", "failed", "degraded"]);
const RUNNING = new Set<Phase>(["casting", "scanning", "revealing", "hunting"]);

function clearSnap() {
  try {
    sessionStorage.removeItem(RESULTS_KEY);
  } catch {
    /* ignore */
  }
}

function readSnap(): ResultSnapshot | null {
  try {
    const snap = JSON.parse(sessionStorage.getItem(RESULTS_KEY) || "null") as ResultSnapshot | null;
    if (!snap || snap.v !== 1 || !Array.isArray(snap.offers)) return null;
    return snap;
  } catch {
    return null;
  }
}

export function ExploreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFiltersState] = useState<ExploreFilters>({ ...DEFAULT_FILTERS, ats: [...DEFAULT_FILTERS.ats] });
  const touched = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [offers, setOffers] = useState<DiscoveredOffer[]>([]);
  const [sources, setSources] = useState<Partial<Record<AtsSource, SourceState>>>({});
  const [matchCount, setMatchCount] = useState(0);
  const [companiesScanned, setCompaniesScanned] = useState(0);
  const [companiesAvailable, setCompaniesAvailable] = useState(0);
  const [capHit, setCapHit] = useState(false);
  const [droppedNoDate, setDroppedNoDate] = useState(0);
  const [status, setStatus] = useState("");
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [mode, setModeState] = useState<ExploreMode>("scan");
  const [resultsMode, setResultsMode] = useState<ExploreMode>("scan");
  const [aiIntent, setAiIntentState] = useState("");
  const [aiTrace, setAiTrace] = useState<AiTraceChunk[]>([]);
  const [aiCost, setAiCost] = useState<AiCost>({ searches: 0, candidates: 0, fetches: 0 });
  const runningRef = useRef(false);
  const aiIntentRef = useRef(aiIntent);
  aiIntentRef.current = aiIntent;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  // Abort + generation: a new search must cancel the previous one, and a late
  // completion from an aborted run must never overwrite fresher results.
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const sessionRestoredRef = useRef(false);
  /** Last AI intent we applied from the URL (or started via Search) — blocks double-hunts. */
  const appliedAiIntentRef = useRef<string | null>(null);

  const setAiIntent = useCallback((s: string) => {
    aiIntentRef.current = s;
    setAiIntentState(s);
  }, []);

  const setFilters = useCallback((f: ExploreFilters) => {
    touched.current = true;
    filtersRef.current = f;
    setFiltersState(f);
  }, []);
  const initFilters = useCallback((f: ExploreFilters) => {
    if (touched.current) return;
    filtersRef.current = f;
    setFiltersState(f);
  }, []);

  const beginRun = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const runId = ++runIdRef.current;
    runningRef.current = true;
    clearSnap();
    return { ac, runId, isCurrent: () => runId === runIdRef.current && !ac.signal.aborted };
  }, []);

  const endRun = useCallback((runId: number) => {
    if (runId === runIdRef.current) {
      runningRef.current = false;
    }
  }, []);

  const discover = useCallback(async () => {
    const f = filtersRef.current;
    const { ac, runId, isCurrent } = beginRun();
    setModeState("scan");
    setResultsMode("scan");
    setPhase("casting");
    setOffers([]);
    setMatchCount(0);
    setCompaniesScanned(0);
    setCompaniesAvailable(0);
    setCapHit(false);
    setDroppedNoDate(0);
    setPartial(false);
    setError("");
    setAiTrace([]);
    setStatus("Casting the net across the ATS network…");
    const init: Partial<Record<AtsSource, SourceState>> = {};
    for (const a of f.ats) init[a] = { state: "queued" };
    setSources(init);
    if (typeof window !== "undefined") {
      const qs = filtersToParams(f);
      window.history.replaceState(null, "", `/explore${qs ? `?${qs}` : ""}`);
    }

    const acc: DiscoveredOffer[] = [];
    let sawError = "";
    let companiesScannedAcc = 0;
    let capHitAcc = false;
    let datasetIssueAcc = false;
    let droppedNoDateAcc = 0;
    try {
      const r = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
        signal: ac.signal,
      });
      if (!isCurrent()) return;
      if (r.status === 400) {
        const d = await r.json().catch(() => ({}));
        sawError = d.error || "The scanner isn't available.";
      } else if (!r.body) {
        sawError = "No response stream.";
      } else {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          if (!isCurrent()) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            return;
          }
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: ScanEvent;
            try {
              ev = JSON.parse(line) as ScanEvent;
            } catch {
              continue;
            }
            switch (ev.kind) {
              case "atsStart":
                if (!isCurrent()) break;
                setPhase("scanning");
                setStatus(`Walking ${ATS_LABEL[ev.ats as AtsSource] ?? ev.ats} — ${ev.companies.toLocaleString()} companies`);
                setSources((s) => ({ ...s, [ev.ats]: { ...s[ev.ats as AtsSource], state: "active", companies: ev.companies } }));
                break;
              case "progress":
                if (!isCurrent()) break;
                setMatchCount((m) => Math.max(m, ev.matches));
                setSources((s) => ({ ...s, [ev.ats]: { ...s[ev.ats as AtsSource], state: "active", done: ev.scanned, total: ev.total } }));
                break;
              case "atsDone":
                if (!isCurrent()) break;
                setSources((s) => ({ ...s, [ev.ats]: { ...s[ev.ats as AtsSource], state: ev.unreachable > 0 ? "noisy" : "swept", unreachable: ev.unreachable } }));
                break;
              case "offer":
                if (!isCurrent()) break;
                acc.push(ev.offer);
                setOffers((o) => [...o, ev.offer]);
                break;
              case "summary": {
                if (!isCurrent()) break;
                companiesScannedAcc = ev.companiesScanned;
                setCompaniesScanned(ev.companiesScanned);
                if (typeof ev.companiesAvailable === "number") setCompaniesAvailable(ev.companiesAvailable);
                if (ev.capHit) {
                  capHitAcc = true;
                  setCapHit(true);
                }
                const datasetIssue = ev.datasetStatus ? Object.values(ev.datasetStatus).some((s) => s !== "ok") : false;
                if (datasetIssue) datasetIssueAcc = true;
                if (typeof ev.postingsDroppedNoDate === "number" && ev.postingsDroppedNoDate > 0) {
                  droppedNoDateAcc = ev.postingsDroppedNoDate;
                  setDroppedNoDate(ev.postingsDroppedNoDate);
                }
                if (ev.unreachable > 0 || datasetIssue) setPartial(true);
                break;
              }
              case "error":
                sawError = ev.message;
                break;
              default:
                break;
            }
          }
        }
      }
    } catch (e) {
      if (ac.signal.aborted || !isCurrent()) return;
      sawError = e instanceof Error ? e.message : "stream error";
    }

    if (!isCurrent()) return;

    setSources((s) => {
      const next = { ...s };
      for (const k of Object.keys(next) as AtsSource[]) if (next[k]?.state === "active" || next[k]?.state === "queued") next[k] = { ...next[k]!, state: "swept" };
      return next;
    });

    endRun(runId);
    if (acc.length > 0) {
      setMatchCount(acc.length);
      setPhase("revealing");
      setStatus(`${acc.length} fresh role${acc.length === 1 ? "" : "s"} found — free.`);
      window.setTimeout(() => {
        if (runId === runIdRef.current) setPhase("results");
      }, 850);
    } else if (sawError) {
      setError(sawError);
      setPhase("failed");
    } else if (capHitAcc || datasetIssueAcc || droppedNoDateAcc > 0 || companiesScannedAcc === 0) {
      setPhase("degraded");
    } else {
      setPhase(isBroadSearch(f) ? "empty-current" : "empty-loose");
    }
  }, [beginRun, endRun]);

  const addToPipeline = useCallback(async (list: DiscoveredOffer[]) => {
    const fresh = list.filter((o) => !added.has(o.url));
    if (fresh.length === 0) return 0;
    setAdding((s) => new Set([...s, ...fresh.map((o) => o.url)]));
    try {
      const r = await fetch("/api/explore/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offers: fresh }),
      });
      const d = (await r.json()) as { added?: number };
      if (d.added && d.added > 0) {
        setAdded((s) => new Set([...s, ...fresh.map((o) => o.url)]));
        router.refresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("co-job-done", { detail: { kind: "explore-add" } }));
        }
      }
      return d.added ?? 0;
    } catch {
      return 0;
    } finally {
      setAdding((s) => {
        const next = new Set(s);
        for (const o of fresh) next.delete(o.url);
        return next;
      });
    }
  }, [added, router]);

  const applyPatch = useCallback((raw: Record<string, unknown>, opts?: { merge?: boolean; run?: boolean }) => {
    const next = parseExplorePatch(raw, filtersRef.current, opts?.merge ?? false);
    setFilters(next);
    filtersRef.current = next;
    if (opts?.run) void discover();
  }, [discover, setFilters]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current += 1;
    runningRef.current = false;
    appliedAiIntentRef.current = null;
    setPhase("idle");
    setOffers([]);
    setSources({});
    setMatchCount(0);
    setCompaniesScanned(0);
    setCompaniesAvailable(0);
    setCapHit(false);
    setDroppedNoDate(0);
    setStatus("");
    setPartial(false);
    setError("");
    setAiTrace([]);
    setAiCost({ searches: 0, candidates: 0, fetches: 0 });
    clearSnap();
  }, []);

  const discoverAI = useCallback(async (intentOverride?: string) => {
    const intent = (intentOverride ?? aiIntentRef.current).trim();
    if (!intent) return;
    // Keep ref + state in lockstep when launched from a URL before React re-renders.
    aiIntentRef.current = intent;
    setAiIntentState(intent);

    const cliId = await resolveCliIdForRun();
    if (!cliId) {
      setModeState("ai");
      setPhase("blocked");
      return;
    }

    const { ac, runId, isCurrent } = beginRun();
    appliedAiIntentRef.current = intent;
    setModeState("ai");
    setResultsMode("ai");
    setPhase("casting");
    setOffers([]);
    setMatchCount(0);
    setAiTrace([]);
    setAiCost({ searches: 0, candidates: 0, fetches: 0 });
    setError("");
    setSources({});
    setStatus("Casting across the open web…");
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/explore?${aiToParams(intent)}`);

    let knownUrls = new Set<string>();
    try {
      const k = await fetch("/api/explore/ai/known", { signal: ac.signal }).then((r) => r.json());
      if (!isCurrent()) return;
      knownUrls = new Set<string>(Array.isArray(k.urls) ? k.urls : []);
    } catch {
      if (ac.signal.aborted || !isCurrent()) return;
    }
    const parser = makeAiStreamParser({ knownUrls });

    const pending: DiscoveredOffer[] = [];
    let sawError = "";
    const handle = (chunks: AiTraceChunk[]) => {
      if (!isCurrent()) return;
      for (const ch of chunks) {
        if (ch.kind === "offer") {
          pending.push(ch.offer);
          setMatchCount(pending.length);
          setAiCost((c) => ({ ...c, candidates: pending.length }));
          setStatus(`Found ${pending.length} candidate${pending.length === 1 ? "" : "s"}… will verify before showing`);
          setPhase("hunting");
        } else {
          setAiTrace((t) => [...t, ch]);
          if (ch.kind === "narration") {
            const s = (ch.text.match(/\bsearch(ing|ed)?\b/gi) || []).length;
            const f = (ch.text.match(/\bfetch(ing|ed)?\b/gi) || []).length;
            if (s || f) setAiCost((c) => ({ ...c, searches: c.searches + s, fetches: c.fetches + f }));
            setPhase((p) => (p === "casting" ? "hunting" : p));
          }
        }
      }
    };

    try {
      const r = await fetch("/api/explore/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: intent, cliId }),
        signal: ac.signal,
      });
      if (!isCurrent()) return;
      if (r.status === 404) {
        endRun(runId);
        setPhase("blocked");
        return;
      }
      if (r.status === 400) {
        const d = await r.json().catch(() => ({}));
        sawError = d.error || "AI search isn't available.";
      } else if (!r.body) {
        sawError = "No response stream.";
      } else {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          if (!isCurrent()) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            return;
          }
          const { value, done } = await reader.read();
          if (done) break;
          handle(parser.feed(dec.decode(value, { stream: true })));
        }
        handle(parser.flush());
      }
    } catch (e) {
      if (ac.signal.aborted || !isCurrent()) return;
      sawError = e instanceof Error ? e.message : "stream error";
    }

    if (!isCurrent()) return;

    const acc: DiscoveredOffer[] = [];
    let expiredDropped = 0;
    if (pending.length > 0 && !sawError) {
      setStatus(`Checking ${pending.length} posting${pending.length === 1 ? "" : "s"} ${pending.length === 1 ? "is" : "are"} still open…`);
      setPhase("hunting");
      try {
        const lr = await fetch("/api/explore/liveness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: pending.map((o) => o.url) }),
          signal: ac.signal,
        });
        if (!isCurrent()) return;
        const data = (await lr.json().catch(() => ({}))) as {
          results?: { url: string; result: string; reason?: string }[];
        };
        const byUrl = new Map((data.results || []).map((x) => [x.url, x]));
        for (const offer of pending) {
          const hit = byUrl.get(offer.url);
          if (hit?.result === "expired") {
            expiredDropped++;
            setAiTrace((t) => [
              ...t,
              {
                kind: "narration",
                text: `Dropped expired: ${offer.title || "role"} @ ${offer.company || "company"}${hit.reason ? ` (${hit.reason})` : ""}`,
              },
            ]);
            continue;
          }
          acc.push({
            ...offer,
            verification: hit?.result === "active" ? "live" : "unconfirmed",
          });
        }
      } catch {
        if (ac.signal.aborted || !isCurrent()) return;
        acc.push(...pending);
      }
      if (!isCurrent()) return;
      setOffers(acc);
      setMatchCount(acc.length);
      setAiCost((c) => ({ ...c, candidates: acc.length }));
    }

    if (!isCurrent()) return;
    endRun(runId);
    if (acc.length > 0) {
      setMatchCount(acc.length);
      setPhase("revealing");
      const dropped = expiredDropped > 0 ? ` · filtered ${expiredDropped} expired` : "";
      setStatus(`${acc.length} candidate${acc.length === 1 ? "" : "s"} found${dropped}.`);
      window.setTimeout(() => {
        if (runId === runIdRef.current) setPhase("results");
      }, 850);
    } else if (sawError) {
      setError(sawError);
      setPhase("failed");
    } else if (expiredDropped > 0) {
      setStatus(`All ${expiredDropped} candidate${expiredDropped === 1 ? "" : "s"} were expired — try a fresher search.`);
      setPhase("empty-loose");
    } else {
      setPhase("empty-loose");
    }
  }, [beginRun, endRun]);

  const setMode = useCallback((m: ExploreMode) => {
    setModeState((prev) => {
      if (prev === m) return prev; // same surface — don't abort an in-flight hunt
      // Stop any in-flight hunt/scan so a mode toggle can't leave a zombie
      // that later writes stale offers into the new surface.
      abortRef.current?.abort();
      abortRef.current = null;
      runIdRef.current += 1;
      runningRef.current = false;
      return m;
    });
  }, []);

  const restoreSnap = useCallback((snap: ResultSnapshot) => {
    // Restore WHICH surface produced these results, not the visible tab: forcing
    // the tab is what made Scan un-selectable after an AI hunt (every return to
    // /explore snapped the toggle back to AI).
    setResultsMode(snap.mode === "ai" ? "ai" : "scan");
    setOffers(snap.offers);
    setMatchCount(typeof snap.matchCount === "number" ? snap.matchCount : snap.offers.length);
    setCompaniesScanned(snap.companiesScanned ?? 0);
    setCompaniesAvailable(snap.companiesAvailable ?? 0);
    setCapHit(!!snap.capHit);
    setDroppedNoDate(snap.droppedNoDate ?? 0);
    setSources(snap.sources ?? {});
    setPartial(!!snap.partial);
    setStatus(typeof snap.status === "string" ? snap.status : "");
    setError(typeof snap.error === "string" ? snap.error : "");
    setAdded(new Set(Array.isArray(snap.added) ? snap.added : []));
    setAiTrace(Array.isArray(snap.aiTrace) ? snap.aiTrace : []);
    setAiCost(snap.aiCost ?? { searches: 0, candidates: 0, fetches: 0 });
    if (typeof snap.aiIntent === "string") setAiIntent(snap.aiIntent);
    let nextPhase = RUNNING.has(snap.phase) ? (snap.offers.length ? "results" : "idle") : snap.phase;
    if (nextPhase === "blocked" && readCliConfig().cliId) {
      nextPhase = snap.offers.length ? "results" : "idle";
    }
    setPhase(nextPhase);
  }, [setAiIntent]);

  // Provider stays mounted across the app shell — so a NEW /explore?mode=ai&intent=…
  // navigation must beat sessionStorage and abort any prior hunt. Same intent we
  // already applied (Search click / replaceState) is a no-op.
  useEffect(() => {
    if (pathname !== "/explore") return;

    const urlAi = paramsToAi(searchParams);

    if (urlAi !== null) {
      const intent = urlAi.trim();
      setModeState("ai");
      setAiIntent(intent);

      if (appliedAiIntentRef.current === intent) return;

      const snap = readSnap();
      const sameSnap = !!snap && snap.mode === "ai" && (snap.aiIntent || "").trim() === intent;
      if (sameSnap && snap && !sessionRestoredRef.current) {
        sessionRestoredRef.current = true;
        appliedAiIntentRef.current = intent;
        restoreSnap(snap);
        return;
      }

      appliedAiIntentRef.current = intent;
      sessionRestoredRef.current = true;
      clearSnap();
      setOffers([]);
      setMatchCount(0);
      setAiTrace([]);
      setAiCost({ searches: 0, candidates: 0, fetches: 0 });
      setStatus("");
      setError("");
      if (intent) void discoverAI(intent);
      return;
    }

    // Bare /explore or scan query — restore last settled snapshot once.
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    const snap = readSnap();
    if (snap) restoreSnap(snap);
  }, [pathname, searchParams, discoverAI, setAiIntent, restoreSnap]);

  useEffect(() => {
    const onConfig = () => {
      if (phase === "blocked" && readCliConfig().cliId) {
        setPhase("idle");
        setError("");
      }
    };
    window.addEventListener("co-config-changed", onConfig);
    return () => window.removeEventListener("co-config-changed", onConfig);
  }, [phase]);

  useEffect(() => {
    if (phase !== "blocked") return;
    void resolveCliIdForRun().then((id) => {
      if (id) {
        setPhase("idle");
        setError("");
      }
    });
  }, [phase]);

  useEffect(() => {
    if (!SETTLED.has(phase)) return;
    try {
      const snap: ResultSnapshot = {
        v: 1, mode: resultsMode, phase, offers, matchCount, companiesScanned, companiesAvailable, capHit, droppedNoDate, sources,
        partial, status, error, added: [...added], aiTrace, aiCost, aiIntent,
      };
      sessionStorage.setItem(RESULTS_KEY, JSON.stringify(snap));
    } catch {
      /* sessionStorage full/unavailable — non-fatal */
    }
  }, [phase, resultsMode, offers, matchCount, companiesScanned, companiesAvailable, capHit, droppedNoDate, sources, partial, status, error, added, aiTrace, aiCost, aiIntent]);

  const value = useMemo(
    () => ({
      filters, setFilters, initFilters, phase,
      running: phase === "casting" || phase === "scanning" || phase === "revealing" || phase === "hunting",
      offers, sources, matchCount, companiesScanned, companiesAvailable, capHit, droppedNoDate, status, partial, error, added, adding,
      discover, addToPipeline, applyPatch, reset,
      mode, setMode, resultsMode, aiIntent, setAiIntent, discoverAI, aiTrace, aiCost,
    }),
    [filters, setFilters, initFilters, phase, offers, sources, matchCount, companiesScanned, companiesAvailable, capHit, droppedNoDate, status, partial, error, added, adding, discover, addToPipeline, applyPatch, reset, mode, setMode, resultsMode, aiIntent, setAiIntent, discoverAI, aiTrace, aiCost],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
