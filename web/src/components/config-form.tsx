"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/dossier/page-shell";
import { MaterialSymbol } from "@/components/material-symbol";
import { ConfigCliTile, type ConfigCli } from "@/components/config/config-cli-tile";
import { KeysPanel } from "@/components/config/keys-panel";
import { ProfilePanel } from "@/components/config/profile-panel";
import { WeightsEditor } from "@/components/config/weights-editor";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Switch } from "@/components/ui/md3-switch";
import { useTheme } from "@/components/providers/theme-provider";
import { cliDisplayName, readCliConfig, writeCliConfig, CONFIG_KEY } from "@/lib/cli-config";
import { cn } from "@/lib/cn";

// The rail switches between groups: one group is mounted at a time. This is a
// deliberate departure from blueprint S13 · redline 1 ("section rail, not tabs
// — the page stays one scrollable document so ⌘F still works"), chosen by the
// maintainer. The trade it accepts: ⌘F only searches the group you are in.
// Redline 2 still holds — every group header names the file it writes, in mono,
// right-aligned and muted.

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: "palette", file: "this browser" },
  { id: "engines", label: "Engines & keys", icon: "terminal", file: `${CONFIG_KEY} · .env` },
  { id: "profile", label: "Profile & ranking", icon: "badge", file: "config/profile.yml · portals.yml" },
  { id: "data", label: "Data", icon: "database", file: "data/ · reports/" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type LocalSettings = { logos: boolean; runTimeout: number; maxWorkers: number; cliId: string };

export function ConfigForm() {
  const { theme, contrast, reduceMotion, setTheme, setContrast, setReduceMotion } = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [local, setLocal] = useState<LocalSettings>({ logos: true, runTimeout: 230, maxWorkers: 3, cliId: "" });
  const [savedLocal, setSavedLocal] = useState<LocalSettings>(local);
  const [clis, setClis] = useState<ConfigCli[] | null>(null);
  const [stats, setStats] = useState({ jobs: 0, reports: 0, contacts: 0 });

  useEffect(() => {
    const cfg = readCliConfig();
    const next: LocalSettings = {
      logos: typeof cfg.logos === "boolean" ? cfg.logos : true,
      runTimeout: typeof cfg.runTimeout === "number" ? cfg.runTimeout : 230,
      maxWorkers: typeof cfg.maxWorkers === "number" ? cfg.maxWorkers : 3,
      cliId: cfg.cliId ?? "",
    };
    setLocal(next);
    setSavedLocal(next);
  }, []);

  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: ConfigCli[] = d.clis ?? [];
        setClis(list);
        const savedCli = readCliConfig().cliId;
        const savedOk = savedCli && list.some((c) => c.id === savedCli && c.installed);
        if (savedOk) return;
        const first = list.find((c) => c.installed)?.id || "";
        if (!first) return;
        setLocal((p) => ({ ...p, cliId: first }));
        setSavedLocal((p) => ({ ...p, cliId: first }));
        writeCliConfig({ cliId: first, mode: "cli" });
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

  const dirty = useMemo(
    () => JSON.stringify(local) !== JSON.stringify(savedLocal),
    [local, savedLocal],
  );

  function save() {
    writeCliConfig({ mode: "cli", ...local });
    setSavedLocal(local);
  }

  function selectCli(id: string) {
    setLocal((p) => ({ ...p, cliId: id }));
    writeCliConfig({ cliId: id, mode: "cli" });
  }

  function goto(id: SectionId) {
    setActiveSection(id);
  }

  const activeCli = clis?.find((c) => c.id === local.cliId);
  const cliReady = !!activeCli?.installed;
  const cliName = cliDisplayName(local.cliId);

  return (
    <PageShell width="wide" className="config-page">
      <div className="flex gap-7">
        <nav className="sticky top-8 hidden w-[190px] shrink-0 flex-col gap-0.5 self-start lg:flex" aria-label="Config sections">
          <p className="mb-2.5 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--md-sys-color-outline)]">
            On this page
          </p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goto(s.id)}
              aria-current={activeSection === s.id ? "true" : undefined}
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
          <p className="md-eyebrow">Settings · the same files the CLI reads</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="md-display-small-emphasized">Config</h1>
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

          <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goto(s.id)}
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

          <ConfigGroup
            id="appearance"
            title="Appearance"
            file="this browser"
            active={activeSection === "appearance"}
          >
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
                value={local.logos ? "logo" : "mono"}
                onChange={(v) => setLocal((p) => ({ ...p, logos: v === "logo" }))}
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
          </ConfigGroup>

          <ConfigGroup
            id="engines"
            title="Engines & keys"
            file={`${CONFIG_KEY} · .env`}
            active={activeSection === "engines"}
          >
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
                  <ConfigCliTile key={c.id} cli={c} selected={c.id === local.cliId} onSelect={() => selectCli(c.id)} />
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
                  value={local.runTimeout}
                  onChange={(e) => setLocal((p) => ({ ...p, runTimeout: Number(e.target.value) }))}
                  className="min-w-0 flex-1 accent-[var(--md-sys-color-primary)]"
                />
                <span className="w-16 text-right font-mono text-sm tabular-nums">{local.runTimeout}s</span>
              </div>
            </ConfigRow>

            <ConfigDivider />

            <ConfigRow title="Max parallel workers" description="Above 3 the CLIs start competing for rate limit">
              <Md3Segmented
                value={String(local.maxWorkers) as "1" | "2" | "3" | "4"}
                onChange={(v) => setLocal((p) => ({ ...p, maxWorkers: Number(v) }))}
                aria-label="Max parallel workers"
                options={(["1", "2", "3", "4"] as const).map((n) => ({ value: n, label: n }))}
              />
            </ConfigRow>

            <ConfigDivider />

            <div>
              <p className="text-base font-semibold">Provider keys</p>
              <p className="mb-4 mt-1 text-[13px] text-[var(--md-sys-color-outline)]">
                Write-only. A stored key is never sent back to this page — only whether it exists and whether it
                still reaches its provider.
              </p>
              <KeysPanel />
            </div>
          </ConfigGroup>

          <ConfigGroup
            id="profile"
            title="Profile & ranking"
            file="config/profile.yml · portals.yml"
            active={activeSection === "profile"}
          >
            <ProfilePanel />

            <ConfigDivider />

            <div>
              <p className="text-base font-semibold">Scoring weights</p>
              <p className="mb-4 mt-1 text-[13px] text-[var(--md-sys-color-outline)]">
                The heuristic fit score Explore ranks with and every report cites. Sliders always sum to 100 and
                write to <code className="font-mono text-xs">portals.yml → ranking.weights</code>.
              </p>
              <WeightsEditor />
            </div>
          </ConfigGroup>

          <ConfigGroup
            id="data"
            title="Data"
            file="data/ · reports/"
            active={activeSection === "data"}
          >
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
            </div>
          </ConfigGroup>

          {cliReady && activeCli && (
            <div className="mt-6 flex items-center gap-4 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container-high)] px-5 py-4">
              <MaterialSymbol name="terminal" size={24} className="text-[var(--md-sys-color-primary)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {cliName} detected at <code className="font-mono text-xs">{activeCli.path || "/usr/local/bin/" + local.cliId}</code>
                </p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Set as the default agent. Change it any time here.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* S13 · state `unsaved`: a sticky bar at the bottom of the pane, not a
          toolbar button that scrolls away from the field being edited. */}
      {dirty && (
        <div className="config-save-bar" role="status">
          <MaterialSymbol name="edit_note" size={20} className="text-[var(--md-sys-color-primary)]" />
          <span className="min-w-0 flex-1 text-sm">
            Unsaved browser settings — <code className="font-mono text-xs">{CONFIG_KEY}</code>
          </span>
          <button type="button" className="md3-btn-text" onClick={() => setLocal(savedLocal)}>
            Discard
          </button>
          <button type="button" className="md3-btn-filled min-h-10" onClick={save}>
            Save
          </button>
        </div>
      )}
    </PageShell>
  );
}

function ConfigGroup({
  id,
  title,
  file,
  active,
  children,
}: {
  id: string;
  title: string;
  file: string;
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) return null;
  return (
    <section id={id} className="config-panel mt-6">
      <header className="config-group-head">
        <h2 className="md-title-medium">{title}</h2>
        <code className="config-group-file">{file}</code>
      </header>
      {children}
    </section>
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
