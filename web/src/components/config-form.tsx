"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/dossier/page-shell";
import { MaterialSymbol } from "@/components/material-symbol";
import { ConfigCliTile, type ConfigCli } from "@/components/config/config-cli-tile";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Switch } from "@/components/ui/md3-switch";
import { useTheme } from "@/components/providers/theme-provider";
import { cliDisplayName, readCliConfig, writeCliConfig, CONFIG_KEY } from "@/lib/cli-config";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "agents", label: "Agents", icon: "terminal" },
  { id: "keys", label: "Keys & paths", icon: "key" },
  { id: "data", label: "Data", icon: "database" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function ConfigForm() {
  const { theme, contrast, reduceMotion, setTheme, setContrast, setReduceMotion } = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [logos, setLogos] = useState(true);
  const [clis, setClis] = useState<ConfigCli[] | null>(null);
  const [cliId, setCliId] = useState("");
  const [runTimeout, setRunTimeout] = useState(230);
  const [maxWorkers, setMaxWorkers] = useState(3);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ jobs: 0, reports: 0, contacts: 0 });

  useEffect(() => {
    const cfg = readCliConfig();
    if (cfg.cliId) setCliId(cfg.cliId);
    if (typeof cfg.logos === "boolean") setLogos(cfg.logos);
    if (typeof cfg.runTimeout === "number") setRunTimeout(cfg.runTimeout);
    if (typeof cfg.maxWorkers === "number") setMaxWorkers(cfg.maxWorkers);
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

  useEffect(() => {
    fetch("/api/report/shape")
      .then((r) => r.json())
      .then((d) => {
        setStats({
          jobs: d?.tracker?.rows ?? 0,
          reports: d?.reports?.count ?? 0,
          contacts: d?.contacts?.count ?? 0,
        });
      })
      .catch(() => undefined);
  }, []);

  function save() {
    writeCliConfig({ mode: "cli", cliId, logos, runTimeout, maxWorkers });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function selectCli(id: string) {
    setCliId(id);
    writeCliConfig({ cliId: id, mode: "cli" });
  }

  const activeCli = clis?.find((c) => c.id === cliId);
  const cliReady = !!activeCli?.installed;
  const cliName = cliDisplayName(cliId);

  return (
    <PageShell width="wide" className="config-page">
      <div className="flex gap-7">
        <nav className="sticky top-8 hidden w-[196px] shrink-0 flex-col gap-0.5 self-start lg:flex" aria-label="Config sections">
          <p className="mb-2.5 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--md-sys-color-outline)]">
            On this page
          </p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex h-11 items-center gap-3 rounded-[var(--md-sys-shape-corner-full)] px-4 text-left text-sm",
                activeSection === s.id
                  ? "bg-[var(--md-sys-color-secondary-container)] font-semibold text-[var(--md-sys-color-on-secondary-container)]"
                  : "text-[var(--md-sys-color-on-surface-variant)]",
              )}
            >
              <MaterialSymbol name={s.icon} size={20} filled={activeSection === s.id} />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <p className="md-eyebrow">Settings · saved to {CONFIG_KEY}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="md-display-small-emphasized">Config</h1>
            <button type="button" onClick={save} className="md3-btn-filled min-h-11">
              {saved ? (
                <>
                  <MaterialSymbol name="check" size={20} />
                  Saved
                </>
              ) : (
                "Save config"
              )}
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-[var(--md-sys-shape-corner-full)] px-3 py-2 text-sm",
                  activeSection === s.id
                    ? "bg-[var(--md-sys-color-secondary-container)] font-semibold text-[var(--md-sys-color-on-secondary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)]",
                )}
              >
                <MaterialSymbol name={s.icon} size={18} filled={activeSection === s.id} />
                {s.label}
              </button>
            ))}
          </div>

          {(activeSection === "appearance" || activeSection === "agents") && (
            <div className="mt-4">
              <span
                className={cn(
                  "config-status-chip",
                  cliReady ? "config-status-chip--ready" : "config-status-chip--pending",
                )}
              >
                <MaterialSymbol name={cliReady ? "bolt" : "schedule"} size={16} filled={cliReady} />
                {cliReady ? `${cliName} ready` : "Finish setup below"}
              </span>
            </div>
          )}

          {activeSection === "appearance" && (
            <section className="config-panel mt-6">
              <ConfigRow
                title="Theme"
                description={
                  <>
                    Sets <code className="font-mono text-xs">data-theme</code> on the html element and persists per browser. System follows the OS.
                  </>
                }
              >
                <Md3Segmented
                  value={theme}
                  onChange={setTheme}
                  aria-label="Theme"
                  options={[
                    { value: "system", label: "System" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              </ConfigRow>

              <ConfigDivider />

              <ConfigRow title="Contrast" description="MD3 standard, medium and high tonal maps">
                <Md3Segmented
                  value={contrast}
                  onChange={setContrast}
                  aria-label="Contrast"
                  options={[
                    { value: "standard", label: "Standard" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                />
              </ConfigRow>

              <ConfigDivider />

              <ConfigRow title="Logo style" description="Company marks in pipeline and reports">
                <Md3Segmented
                  value={logos ? "logo" : "mono"}
                  onChange={(v) => setLogos(v === "logo")}
                  aria-label="Logo style"
                  options={[
                    { value: "mono", label: "Mark" },
                    { value: "logo", label: "Wordmark" },
                  ]}
                />
              </ConfigRow>

              <ConfigDivider />

              <ConfigRow title="Reduce motion" description="Cuts MD3 emphasized transitions to a fade">
                <Md3Switch checked={reduceMotion} onChange={setReduceMotion} aria-label="Reduce motion" />
              </ConfigRow>

              <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                <ThemePreview label="Dark" variant="dark" />
                <ThemePreview label="Light" variant="light" />
              </div>
            </section>
          )}

          {activeSection === "agents" && (
            <section className="config-panel mt-6">
              <ConfigRow
                title="Default CLI"
                description={
                  <>
                    Every scan, score and apply run shells out to this binary. Detected on <code className="font-mono text-xs">$PATH</code> at startup.
                  </>
                }
              >
                <button type="button" className="md3-btn-outlined min-h-10" onClick={() => window.location.reload()}>
                  <MaterialSymbol name="refresh" size={18} />
                  Re-detect
                </button>
              </ConfigRow>

              <div className="mt-4 flex flex-col gap-2">
                {clis === null ? (
                  <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Scanning PATH…</p>
                ) : (
                  clis.map((c) => (
                    <ConfigCliTile key={c.id} cli={c} selected={c.id === cliId} onSelect={() => selectCli(c.id)} />
                  ))
                )}
              </div>

              <ConfigDivider />

              <ConfigRow title="Run timeout" description="Soft limit — partial results are kept when it fires">
                <div className="flex w-full max-w-xs items-center gap-3">
                  <input
                    type="range"
                    min={60}
                    max={600}
                    step={10}
                    value={runTimeout}
                    onChange={(e) => setRunTimeout(Number(e.target.value))}
                    className="min-w-0 flex-1 accent-[var(--md-sys-color-primary)]"
                  />
                  <span className="w-16 text-right font-mono text-sm tabular-nums">{runTimeout}s</span>
                </div>
              </ConfigRow>

              <ConfigDivider />

              <ConfigRow title="Max parallel workers" description="Above 3 the CLIs start competing for rate limit">
                <Md3Segmented
                  value={String(maxWorkers) as "1" | "2" | "3" | "4"}
                  onChange={(v) => setMaxWorkers(Number(v))}
                  aria-label="Max parallel workers"
                  options={(["1", "2", "3", "4"] as const).map((n) => ({ value: n, label: n }))}
                />
              </ConfigRow>
            </section>
          )}

          {activeSection === "keys" && (
            <section className="config-panel mt-6 space-y-4">
              <div>
                <p className="text-sm font-medium">Anthropic API key</p>
                <div className="md3-field mt-2 min-h-14 rounded-[var(--md-sys-shape-corner-large)]">
                  <MaterialSymbol name="key" size={20} className="md3-field__icon" />
                  <span className="flex-1 font-mono text-sm text-[var(--md-sys-color-on-surface-variant)]">sk-ant-••••••••••••••••••4f2a</span>
                  <span className="rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-tertiary-container)] px-2.5 py-1 text-xs font-semibold text-[var(--md-sys-color-on-tertiary-container)]">
                    <MaterialSymbol name="check" size={14} /> valid
                  </span>
                  <MaterialSymbol name="visibility" size={20} className="text-[var(--md-sys-color-outline)]" />
                </div>
                <p className="mt-1.5 text-xs text-[var(--md-sys-color-outline)]">
                  Falls back to <code className="font-mono">ANTHROPIC_API_KEY</code> in the environment.
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Workspace directory</p>
                <div className="md3-field mt-2 min-h-14 rounded-[var(--md-sys-shape-corner-large)]">
                  <MaterialSymbol name="folder" size={20} className="md3-field__icon" />
                  <span className="flex-1 truncate font-mono text-sm">~/career-ops/data</span>
                  <span className="text-sm font-medium text-[var(--md-sys-color-primary)]">Change</span>
                </div>
              </div>
            </section>
          )}

          {activeSection === "data" && (
            <section className="config-panel mt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">
                    {stats.jobs} jobs · {stats.reports} reports · {stats.contacts} contacts
                  </p>
                  <p className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    Everything lives in local files. Export before you move machines.
                  </p>
                </div>
                <a href="/api/export?kind=all" className="md3-btn-outlined min-h-11">
                  <MaterialSymbol name="download" size={20} />
                  Export all
                </a>
                <button type="button" className="md3-btn-outlined min-h-11 border-[var(--md-sys-color-error)] text-[var(--md-sys-color-error)]">
                  <MaterialSymbol name="delete_forever" size={20} />
                  Reset
                </button>
              </div>
            </section>
          )}

          {cliReady && activeCli && (
            <div className="mt-6 flex items-center gap-4 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container-high)] px-5 py-4">
              <MaterialSymbol name="terminal" size={24} className="text-[var(--md-sys-color-primary)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {cliName} detected at <code className="font-mono text-xs">{activeCli.path || "/usr/local/bin/" + cliId}</code>
                </p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Set as the default agent. Change it any time here.</p>
              </div>
              <Link href="/config" className="md3-btn-text text-sm">
                Open Config
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function ConfigRow({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1 text-[13px] text-[var(--md-sys-color-outline)]">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ConfigDivider() {
  return <div className="my-5 border-t border-[var(--md-sys-color-outline-variant)]" />;
}

function ThemePreview({ label, variant }: { label: string; variant: "dark" | "light" }) {
  const isDark = variant === "dark";
  return (
    <div
      className="rounded-[var(--md-sys-shape-corner-large-increased)] p-3.5"
      style={{ background: isDark ? "var(--md-sys-color-surface)" : "#FCEAE2" }}
    >
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--md-sys-color-outline)]">{label}</p>
      <div
        className="rounded-[var(--md-sys-shape-corner-large)] p-3"
        style={{ background: isDark ? "var(--md-sys-color-primary)" : "#97490B", color: isDark ? "var(--md-sys-color-on-primary)" : "#fff" }}
      >
        <p className="text-sm font-bold">Lumenwerk</p>
        <p className="text-xs opacity-80">Platform Engineer</p>
      </div>
      <div
        className="mt-2 rounded-[var(--md-sys-shape-corner-large)] p-3"
        style={{
          background: isDark ? "var(--md-sys-color-surface-container-high)" : "#FFDBC8",
          color: isDark ? "var(--md-sys-color-on-surface)" : "#341100",
        }}
      >
        <p className="text-sm font-bold">Auria Mobility</p>
        <p className="text-xs opacity-80">LLMOps Engineer</p>
      </div>
    </div>
  );
}
