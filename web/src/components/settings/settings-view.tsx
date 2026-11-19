"use client";

import { useState } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { writeCliConfig } from "@/lib/cli-config";
import type { SearchCompany, SearchSettings } from "@/lib/search/settings";

type Engine = { id: string; name: string; installed: boolean };
type Health = Record<string, { status: string; detail: string }>;

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Could not save.");
  return data as T;
}

export function SettingsView({ engines, engine: initialEngine, search: initialSearch, dataDir }: { engines: Engine[]; engine: string | null; search: SearchSettings; dataDir: string }) {
  return (
    <div className="search-page">
      <header className="search-head">
        <div>
          <h1 className="md-headline-medium">Settings</h1>
          <p className="search-sub">Which AI runs your tasks and what Search looks for. Your profile, CV and writing voice live in Brain.</p>
        </div>
      </header>
      <div className="settings-grid">
        <EngineCard engines={engines} initial={initialEngine} />
        <DataCard dataDir={dataDir} />
      </div>
      <SearchCard initial={initialSearch} />
      <CompaniesCard initial={initialSearch.companies} />
    </div>
  );
}

function Card({ title, hint, children, actions }: { title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="apply-card settings-card">
      <div className="settings-card__head">
        <div>
          <h2 className="md-title-medium">{title}</h2>
          {hint && <p className="apply-muted">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EngineCard({ engines, initial }: { engines: Engine[]; initial: string | null }) {
  const [engine, setEngine] = useState(initial);
  const [error, setError] = useState("");
  async function choose(id: string) {
    setError("");
    try {
      await send("/api/clis", "POST", { cliId: id });
      writeCliConfig({ cliId: id, mode: "cli" });
      setEngine(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch.");
    }
  }
  return (
    <Card title="AI engine" hint="Runs on your own subscription login. Nothing else is needed.">
      <div className="settings-engines" role="radiogroup" aria-label="AI engine">
        {engines.map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={engine === e.id} disabled={!e.installed} className="settings-engine" data-active={engine === e.id} onClick={() => void choose(e.id)}>
            <MaterialSymbol name={engine === e.id ? "radio_button_checked" : "radio_button_unchecked"} size={20} />
            <span>
              <strong>{e.name}</strong>
              <small>{e.installed ? (engine === e.id ? "In use" : "Installed") : "Not installed"}</small>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="search-error">{error}</p>}
    </Card>
  );
}

function DataCard({ dataDir }: { dataDir: string }) {
  return (
    <Card title="Your data" hint="Everything stays on this computer.">
      <p className="settings-path"><MaterialSymbol name="folder" size={18} />{dataDir}</p>
      <div className="settings-row">
        <a href="/api/export?kind=all" className="md3-action-btn md3-action-btn--outlined"><span className="md3-action-btn__label">Export everything (JSON)</span></a>
        <a href="/api/export?kind=tracker" className="md3-action-btn md3-action-btn--outlined"><span className="md3-action-btn__label">Export applications (CSV)</span></a>
      </div>
    </Card>
  );
}

function SearchCard({ initial }: { initial: SearchSettings }) {
  const [form, setForm] = useState(() => ({
    titles: initial.titles.join("\n"),
    skipTitles: initial.skipTitles.join("\n"),
    alwaysAllow: initial.alwaysAllow.join("\n"),
    allow: initial.allow.join("\n"),
    block: initial.block.join("\n"),
    maxAgeDays: initial.maxAgeDays ? String(initial.maxAgeDays) : "",
  }));
  const [boards, setBoards] = useState(initial.boards);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setState("idle");
  };

  async function save() {
    setState("saving");
    setError("");
    try {
      await send("/api/settings/search", "PUT", {
        titles: lines(form.titles),
        skipTitles: lines(form.skipTitles),
        alwaysAllow: lines(form.alwaysAllow),
        allow: lines(form.allow),
        block: lines(form.block),
        maxAgeDays: form.maxAgeDays ? Number(form.maxAgeDays) : 0,
        boards: Object.fromEntries(boards.map((b) => [b.id, b.enabled])),
      });
      setState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setState("idle");
    }
  }

  const field = (key: keyof typeof form, label: string, hint: string) => (
    <label className="settings-field">
      <span>{label}</span>
      <textarea rows={5} value={form[key]} onChange={set(key)} />
      <small>{hint}</small>
    </label>
  );

  return (
    <Card
      title="What to search for"
      hint="Used by Scan job boards and by AI search. One item per line."
      actions={
        <button type="button" className="md3-action-btn md3-action-btn--filled" onClick={() => void save()} disabled={state === "saving"}>
          <MaterialSymbol name={state === "saved" ? "check" : "save"} size={18} />
          <span className="md3-action-btn__label">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}</span>
        </button>
      }
    >
      <div className="settings-fields">
        {field("titles", "Job titles to find", "A job is kept when its title contains one of these.")}
        {field("skipTitles", "Titles to skip", "e.g. Intern, Sales, Data Scientist")}
        {field("alwaysAllow", "Locations always OK", "Your home country or city. Always kept.")}
        {field("allow", "Other allowed locations", "e.g. Remote, Worldwide. \"Remote - US\" is not kept unless US is listed.")}
        {field("block", "Blocked locations", "Never kept unless also in Always OK.")}
        <div className="settings-field">
          <span>Ignore postings older than</span>
          <div className="settings-row">
            <input type="number" min={0} value={form.maxAgeDays} onChange={set("maxAgeDays")} className="settings-number" aria-label="Days" />
            <span className="apply-muted">days (empty = any age)</span>
          </div>
          <span className="settings-subhead">Job boards</span>
          {boards.map((b) => (
            <label key={b.id} className="settings-check">
              <input type="checkbox" checked={b.enabled} onChange={(e) => { setBoards((all) => all.map((x) => (x.id === b.id ? { ...x, enabled: e.target.checked } : x))); setState("idle"); }} />
              {b.label}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="search-error">{error}</p>}
    </Card>
  );
}

function CompaniesCard({ initial }: { initial: SearchCompany[] }) {
  const [companies, setCompanies] = useState(initial);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);

  async function act(body: Record<string, unknown>) {
    setError("");
    try {
      const next = await send<SearchSettings>("/api/settings/search", "POST", body);
      setCompanies(next.companies);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await act({ action: "add", name, url })) { setName(""); setUrl(""); }
  }

  async function check() {
    setChecking(true);
    try {
      const res = await fetch("/api/portals/verify", { cache: "no-store" });
      const data = (await res.json()) as { companies?: { name: string; status: string; detail: string }[] };
      setHealth(Object.fromEntries((data.companies ?? []).map((c) => [c.name, c])));
    } finally {
      setChecking(false);
    }
  }

  const withFeed = companies.filter((c) => c.feed).length;
  return (
    <Card
      title={`Companies (${companies.length})`}
      hint={`${withFeed} have a public job feed and are scanned for free. The rest are covered by AI search.`}
      actions={
        <button type="button" className="md3-action-btn md3-action-btn--outlined" onClick={() => void check()} disabled={checking}>
          <MaterialSymbol name={checking ? "progress_activity" : "network_check"} size={18} className={checking ? "animate-spin" : undefined} />
          <span className="md3-action-btn__label">{checking ? "Checking…" : "Check feeds"}</span>
        </button>
      }
    >
      <form className="settings-add" onSubmit={(e) => void add(e)}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" aria-label="Company name" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Careers page URL (Greenhouse, Lever, Ashby… links are scanned for free)" aria-label="Careers page URL" />
        <button type="submit" className="md3-action-btn md3-action-btn--filled" disabled={!name.trim() || !url.trim()}>Add</button>
      </form>
      {error && <p className="search-error">{error}</p>}
      <div className="settings-companies" role="table" aria-label="Companies">
        {companies.map((c) => {
          const h = health?.[c.name];
          return (
            <div key={c.name} className="settings-company" role="row" data-off={!c.enabled}>
              <label className="settings-check" role="cell">
                <input type="checkbox" checked={c.enabled} onChange={(e) => void act({ action: "toggle", name: c.name, enabled: e.target.checked })} aria-label={`Scan ${c.name}`} />
                <strong>{c.name}</strong>
              </label>
              <span role="cell" className="search-chip">{c.feed ?? "AI search"}</span>
              <span role="cell" className="settings-health" data-status={h?.status}>{h ? h.detail : ""}</span>
              <span role="cell" className="search-actions">
                {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="search-icon-btn" title="Open careers page" aria-label={`Open ${c.name} careers page`}><MaterialSymbol name="open_in_new" size={18} /></a>}
                <button type="button" className="search-icon-btn" title="Remove" aria-label={`Remove ${c.name}`} onClick={() => void act({ action: "remove", name: c.name })}><MaterialSymbol name="delete" size={18} /></button>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
