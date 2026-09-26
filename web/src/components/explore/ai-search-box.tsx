"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CostBadge } from "@/components/cost/cost-badge";
import { estimateSpend, fmtUsd, type SpendEstimate } from "@/lib/explore-spend";

const EXAMPLES = [
  "AI infra roles at climate startups, remote EU",
  "Forward-deployed engineer at Series A devtools, US-remote",
  "Head of Applied AI at healthtech, posted this week",
];

type SavedSearch = { name: string; query: string; lastRunAt?: string; urls?: string[] };
const SAVED_SEARCHES_KEY = "career-ops:explore-saved-searches";

export function AiSearchBox({
  intent,
  onIntent,
  onSubmit,
  cliConfigured,
  cliName,
  onRunScan,
  results = [],
  resultsSettled = false,
  settledIntent = "",
}: {
  intent: string;
  onIntent: (s: string) => void;
  onSubmit: (query?: string) => void;
  cliConfigured: boolean;
  cliName?: string;
  onRunScan: () => void;
  results?: { url: string }[];
  resultsSettled?: boolean;
  settledIntent?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // S04 · gap 6 — the estimate is stated BEFORE the run, on the row that runs it.
  // localStorage is client-only, so it is read after mount to keep SSR stable.
  const [estimate, setEstimate] = useState<SpendEstimate | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveName, setSaveName] = useState("");
  const [changes, setChanges] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState("");
  const [freshness, setFreshness] = useState("");
  const [compensation, setCompensation] = useState("");
  const [source, setSource] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const touched = useRef(false);
  function composeIntent() {
    const clauses = [role && `roles: ${role}`, location && `location: ${location}`, remote && `work style: ${remote}`, freshness && `posted within: ${freshness}`, compensation && `compensation: ${compensation}`, source && `source: ${source}`].filter(Boolean);
    return clauses.length ? `${intent.trim()}${intent.trim() ? "; " : "Find roles"}${clauses.join("; ")}` : intent.trim();
  }
  function submitSearch() { const query = composeIntent(); if (query) { setActiveQuery(query); sessionStorage.setItem("career-ops:explore-active-query", query); onSubmit(query); } }
  useEffect(() => setEstimate(estimateSpend()), []);
  useEffect(() => {
    const pendingQuery = sessionStorage.getItem("career-ops:explore-active-query");
    if (pendingQuery) setActiveQuery(pendingQuery);
  }, []);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || "[]");
      if (Array.isArray(value)) setSavedSearches(value.filter((item) => item && typeof item.name === "string" && typeof item.query === "string").slice(0, 20));
    } catch { /* ignore broken browser storage */ }
  }, []);
  useEffect(() => {
    const query = composeIntent();
    if (!resultsSettled || !query || query !== activeQuery || settledIntent.trim() !== query) return;
    const current = [...new Set(results.map((item) => item.url))];
    const index = savedSearches.findIndex((item) => item.query.trim().toLowerCase() === query.toLowerCase());
    const prior = index >= 0 ? savedSearches[index].urls : undefined;
    if (prior) {
      const old = new Set(prior);
      const next = new Set(current);
      setChanges(`${current.filter((url) => !old.has(url)).length} new · ${prior.filter((url) => !next.has(url)).length} not returned since the previous run`);
    }
    if (index >= 0) {
      const next = [...savedSearches];
      next[index] = { ...next[index], lastRunAt: new Date().toISOString(), urls: current };
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
      setSavedSearches(next);
    }
    sessionStorage.removeItem("career-ops:explore-active-query");
    setActiveQuery("");
  }, [resultsSettled, results, intent, role, location, remote, freshness, compensation, source, activeQuery, settledIntent, savedSearches]);
  function saveSearch() {
    const name = saveName.trim();
    const query = composeIntent();
    if (!name || !query) return;
    const next = [{ name, query }, ...savedSearches.filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 20);
    setSavedSearches(next);
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
    setSaveName("");
  }
  const grow = () => {
    const t = ref.current;
    if (t) {
      t.style.height = "auto";
      t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
    }
  };

  return (
    <div>
      <div className="rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-primary-container)] bg-[var(--md-sys-color-surface-container)] p-6 transition-[border-color,box-shadow] duration-300 focus-within:border-[var(--md-sys-color-primary)] focus-within:shadow-[0_0_0_1px_var(--md-sys-color-primary)]">
        <div className="mb-3 flex items-center gap-2 md-label-large text-[var(--md-sys-color-primary)]">
          <MaterialSymbol name="auto_awesome" size={18} />
          Describe the role — an AI hunts the open web for it
        </div>
        <textarea
          ref={ref}
          rows={2}
          value={intent}
          onChange={(e) => {
            touched.current = true;setActiveQuery("");
            onIntent(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (intent.trim() || role || location) submitSearch();
            }
          }}
          placeholder="“AI infra at climate startups, remote EU, not staff-level” — plain language, your words"
          className="w-full resize-none border-none bg-transparent text-lg leading-7 text-[var(--md-sys-color-on-surface)] outline-none placeholder:text-[var(--md-sys-color-outline)]"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            {cliConfigured ? (
              <>
                Reads the public web with <span className="text-[var(--md-sys-color-on-surface)]">{cliName || "your CLI"}</span> — it costs your tokens.
                {estimate && (
                  <>
                    {" "}
                    <span className="text-[var(--md-sys-color-on-surface)]">
                      Estimated {fmtUsd(estimate.usd)}
                    </span>{" "}
                    <span className="opacity-80">
                      ({estimate.basis === "history"
                        ? `average of your last ${estimate.runs} hunt${estimate.runs === 1 ? "" : "s"}`
                        : "typical first hunt"}
                      )
                    </span>
                  </>
                )}
              </>
            ) : (
              "Connect an AI CLI in Config to use AI search."
            )}
          </span>
          <button
            type="button"
            disabled={!intent.trim() && !role.trim() && !location.trim()}
            onClick={submitSearch}
            className="md3-btn-filled disabled:opacity-50"
          >
            Search the open web
            <CostBadge kind="spend" size="xs" />
            <MaterialSymbol name="arrow_forward" size={18} />
          </button>
        </div>
        <button type="button" className="md3-btn-text mt-2 min-h-10" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>{filtersOpen ? "Hide quick filters" : "Quick filters"}</button>
        {filtersOpen && <div className="mt-2 grid gap-3 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3 sm:grid-cols-2 lg:grid-cols-3">
          <input aria-label="Filter by role" className="md3-field__input" value={role} onChange={e=>{setActiveQuery("");setRole(e.target.value);}} placeholder="Role" />
          <input aria-label="Filter by location" className="md3-field__input" value={location} onChange={e=>{setActiveQuery("");setLocation(e.target.value);}} placeholder="Location" />
          <select aria-label="Remote policy" className="md3-field__input" value={remote} onChange={e=>{setActiveQuery("");setRemote(e.target.value);}}><option value="">Any work style</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select>
          <select aria-label="Freshness" className="md3-field__input" value={freshness} onChange={e=>{setActiveQuery("");setFreshness(e.target.value);}}><option value="">Any posting date</option><option>24 hours</option><option>3 days</option><option>7 days</option><option>14 days</option><option>30 days</option></select>
          <input aria-label="Compensation filter" className="md3-field__input" value={compensation} onChange={e=>{setActiveQuery("");setCompensation(e.target.value);}} placeholder="Compensation, currency, period" />
          <select aria-label="Search source" className="md3-field__input" value={source} onChange={e=>{setActiveQuery("");setSource(e.target.value);}}><option value="">Any public source</option><option>Employer career sites</option><option>Public hiring posts</option><option>Job boards</option></select>
          <p className="text-xs text-[var(--md-sys-color-outline)] sm:col-span-2 lg:col-span-3">Quick filters are included in the web search request. Dates and compensation are verified from each result when available.</p>
        </div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="saved-searches">Saved searches</label>
          <select id="saved-searches" aria-label="Saved searches" className="md3-field__input min-h-10 text-sm" value="" onChange={(event) => { const search = savedSearches.find((item) => item.name === event.target.value); if (search) { touched.current = true; setActiveQuery(""); setRole(""); setLocation(""); setRemote(""); setFreshness(""); setCompensation(""); setSource(""); onIntent(search.query); setChanges(""); } }}>
            <option value="">Saved searches ({savedSearches.length})</option>
            {savedSearches.map((item) => <option key={item.name} value={item.name}>{item.name}{item.lastRunAt ? ` · ${new Date(item.lastRunAt).toLocaleDateString()}` : ""}</option>)}
          </select>
          <input aria-label="Saved search name" className="md3-field__input min-h-10 w-44 text-sm" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Name this search" />
          <button type="button" className="md3-btn-outlined min-h-10" disabled={!saveName.trim() || !composeIntent()} onClick={saveSearch}>Save search</button>
          {changes && <span role="status" className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{changes}</span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
              onClick={() => { touched.current = true; setActiveQuery(""); setRole(""); setLocation(""); setRemote(""); setFreshness(""); setCompensation(""); setSource(""); onIntent(ex); }}
            className="md3-chip min-h-[40px] rounded-[var(--md-sys-shape-corner-full)]"
          >
            {ex}
          </button>
        ))}
        <button
          type="button"
          onClick={onRunScan}
          className="md3-btn-text ml-auto md-body-small"
        >
          or run the free Scan instead →
        </button>
      </div>
    </div>
  );
}
