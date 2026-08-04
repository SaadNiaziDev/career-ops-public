"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierHero } from "@/components/dossier/dossier-hero";
import { MaterialSymbol } from "@/components/material-symbol";
import { ConfigCliTile, type ConfigCli } from "@/components/config/config-cli-tile";
import { ConfigEngineDiagram } from "@/components/config/config-engine-diagram";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3SelectableCard } from "@/components/ui/md3-selectable-card";
import { Button } from "@/components/ui/button";
import { cliDisplayName, readCliConfig, writeCliConfig, CONFIG_KEY } from "@/lib/cli-config";
import { cn } from "@/lib/cn";

type Mode = "cli" | "key" | "manual";

const STORAGE_KEY = CONFIG_KEY;

const MODE_OPTIONS: {
  value: Mode;
  icon: string;
  title: string;
  subtitle: string;
  blurb: string;
  disabled?: boolean;
}[] = [
  {
    value: "cli",
    icon: "terminal",
    title: "Local CLI",
    subtitle: "Recommended",
    blurb: "Spawn workers through a tool you already signed into — Claude Code, Codex, Cursor, and more.",
  },
  {
    value: "key",
    icon: "key",
    title: "API key",
    subtitle: "Soon",
    blurb: "Paste a provider key when you want a hosted model without a CLI.",
    disabled: true,
  },
  {
    value: "manual",
    icon: "touch_app",
    title: "Manual",
    subtitle: "Soon",
    blurb: "Use the web UI only — copy prompts and run modes yourself.",
    disabled: true,
  },
];

const PRIVACY_POINTS = [
  {
    icon: "folder_shared",
    title: "Files never upload",
    body: "CV, tracker, and reports stay in your repo folder.",
  },
  {
    icon: "person",
    title: "Your AI account",
    body: "Workers bill against the CLI you already use — not career-ops.",
  },
  {
    icon: "shield",
    title: "No hosted login",
    body: "This app does not store credentials or run models in the cloud.",
  },
] as const;

export function ConfigForm() {
  const [mode, setMode] = useState<Mode>("cli");
  const [clis, setClis] = useState<ConfigCli[] | null>(null);
  const [cliId, setCliId] = useState<string>("");
  const [provider, setProvider] = useState("anthropic");
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.mode === "cli") setMode("cli");
        if (v.cliId) setCliId(v.cliId);
        if (v.provider) setProvider(v.provider);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: ConfigCli[] = d.clis ?? [];
        setClis(list);
        const savedCli = readCliConfig().cliId;
        const savedOk = savedCli && list.some((c) => c.id === savedCli && c.installed);
        if (savedOk) {
          setCliId(savedCli);
          return;
        }
        const first = list.find((c) => c.installed)?.id || "";
        setCliId(first);
        if (first) writeCliConfig({ cliId: first, mode: "cli" });
      })
      .catch(() => setClis([]));
  }, []);

  function save() {
    writeCliConfig({ mode, cliId, provider, logos });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function selectCli(id: string) {
    setCliId(id);
    writeCliConfig({ cliId: id, mode: "cli" });
  }

  const installed = clis?.filter((c) => c.installed) ?? [];
  const activeCli = clis?.find((c) => c.id === cliId);
  const cliReady = mode === "cli" && !!activeCli?.installed;
  const cliName = cliDisplayName(cliId);

  const modeBlurb = useMemo(
    () => MODE_OPTIONS.find((m) => m.value === mode)?.blurb ?? "",
    [mode],
  );

  return (
    <PageShell width="default" className="config-page">
      <DossierHero
        eyebrow="Local-first · Engine setup"
        title="Wire up your engine"
        description="career-ops runs on your machine. Pick how workers connect, choose a CLI, and tune the UI — nothing leaves your computer unless you open a job posting."
        actions={
          <>
            <Button variant="primary" size="hero" onClick={save}>
              {saved ? (
                <>
                  <MaterialSymbol name="check" size={20} />
                  Saved
                </>
              ) : (
                "Save config"
              )}
            </Button>
            <span
              className={cn(
                "config-status-chip",
                cliReady ? "config-status-chip--ready" : "config-status-chip--pending",
              )}
            >
              <MaterialSymbol name={cliReady ? "bolt" : "schedule"} size={16} filled={cliReady} />
              {cliReady ? `${cliName} ready` : "Finish setup below"}
            </span>
          </>
        }
        footer={<ConfigEngineDiagram cliName={cliName} cliReady={cliReady} logos={logos} />}
      />

      <div className="config-grid">
        <section className="config-panel" aria-labelledby="config-mode-heading">
          <header className="config-panel__header">
            <div>
              <h2 id="config-mode-heading" className="config-panel__title">
                Connection method
              </h2>
              <p className="config-panel__lede">How should workers reach an AI model?</p>
            </div>
          </header>

          <div className="config-mode-grid" role="radiogroup" aria-label="Connection method">
            {MODE_OPTIONS.map((opt) => {
              const selected = mode === opt.value;
              return (
                <Md3SelectableCard
                  key={opt.value}
                  selected={selected}
                  disabled={opt.disabled}
                  onSelect={() => setMode(opt.value)}
                  className="config-mode-card"
                >
                  <div className="config-mode-card__body">
                    <span className="config-mode-card__icon" aria-hidden>
                      <MaterialSymbol name={opt.icon} size={22} />
                    </span>
                    <span className="config-mode-card__title">{opt.title}</span>
                    <span className="config-mode-card__subtitle">{opt.subtitle}</span>
                  </div>
                </Md3SelectableCard>
              );
            })}
          </div>

          <p className="config-panel__note">{modeBlurb}</p>

          {mode === "key" && <Md3Empty description="API key mode is on the roadmap." />}
          {mode === "manual" && (
            <p className="md3-alert md3-alert--info">The easiest way in — no keys, nothing to set up. On the roadmap.</p>
          )}
        </section>

        <section className="config-panel" aria-labelledby="config-cli-heading">
          <header className="config-panel__header">
            <div>
              <h2 id="config-cli-heading" className="config-panel__title">
                AI worker
              </h2>
              <p className="config-panel__lede">
                {mode === "cli"
                  ? `${installed.length} tool${installed.length === 1 ? "" : "s"} detected on this machine`
                  : "Available when CLI mode is selected"}
              </p>
            </div>
            {mode === "cli" && installed.length === 0 && clis !== null ? (
              <a
                href="https://career-ops.org/docs/free-ai-engine"
                target="_blank"
                rel="noreferrer"
                className="config-panel__link"
              >
                Get a free CLI
                <MaterialSymbol name="open_in_new" size={14} />
              </a>
            ) : null}
          </header>

          {mode !== "cli" ? (
            <div className="config-panel__placeholder">
              <MaterialSymbol name="terminal" size={28} className="text-[var(--md-sys-color-outline)]" />
              <p>Switch to Local CLI to pick a worker.</p>
            </div>
          ) : clis === null ? (
            <div className="config-panel__loading">
              <MaterialSymbol name="progress_activity" size={24} className="animate-spin text-[var(--md-sys-color-primary)]" />
              <span>Scanning PATH for installed tools…</span>
            </div>
          ) : installed.length === 0 ? (
            <div className="md3-alert md3-alert--info">
              No AI CLI detected yet. Free options like OpenCode with Qwen or GLM work great — install one, then refresh
              this page.
            </div>
          ) : (
            <div className="config-cli-grid">
              {clis.map((c) => (
                <ConfigCliTile
                  key={c.id}
                  cli={c}
                  selected={c.id === cliId}
                  onSelect={() => selectCli(c.id)}
                />
              ))}
            </div>
          )}

          {mode === "cli" && installed.length > 0 ? (
            <p className="config-panel__note">
              Claude Code unlocks live worker progress, agentic apply, and the most reliable report persistence. Other
              CLIs cover evaluate, PDF, and outreach flows.
            </p>
          ) : null}
        </section>
      </div>

      <section className="config-appearance" aria-labelledby="config-appearance-heading">
        <div className="config-appearance__copy">
          <h2 id="config-appearance-heading" className="config-panel__title">
            Appearance
          </h2>
          <p className="config-panel__lede">
            Company marks in pipeline and reports — real logos when enabled, deterministic monograms when off.
          </p>
        </div>

        <div className="config-appearance__preview" aria-hidden>
          <div className="config-logo-preview" data-mode={logos ? "logo" : "mono"}>
            <span className="config-logo-preview__label">Preview</span>
            <div className="config-logo-preview__marks">
              <span className="config-logo-preview__mark config-logo-preview__mark--mono">AC</span>
              <span className="config-logo-preview__mark config-logo-preview__mark--logo">
                <MaterialSymbol name="domain" size={18} />
              </span>
            </div>
            <span className="config-logo-preview__caption">{logos ? "Favicon logos" : "Monograms only"}</span>
          </div>
        </div>

        <label className="config-appearance__toggle">
          <span className="sr-only">Show company logos</span>
          <input type="checkbox" checked={logos} onChange={(e) => setLogos(e.target.checked)} />
          <span className="md3-switch__track" />
          <span className="md3-switch__thumb" />
        </label>
      </section>

      <section className="config-privacy" aria-label="Privacy guarantees">
        {PRIVACY_POINTS.map((point) => (
          <article key={point.title} className="config-privacy__item">
            <span className="config-privacy__icon" aria-hidden>
              <MaterialSymbol name={point.icon} size={22} />
            </span>
            <h3 className="config-privacy__title">{point.title}</h3>
            <p className="config-privacy__body">{point.body}</p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
