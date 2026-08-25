"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { ConfigCliTile, type ConfigCli } from "@/components/config/config-cli-tile";
import { CvIngest } from "@/components/cv/cv-ingest";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { cliDisplayName, readCliConfig, writeCliConfig } from "@/lib/cli-config";
import { cn } from "@/lib/cn";

type WizardStep = "cli" | "cv";

export function FirstRunHome() {
  const [wizardStep, setWizardStep] = useState<WizardStep>("cli");
  const [clis, setClis] = useState<ConfigCli[]>([]);
  const [cliId, setCliId] = useState<string>("");

  useEffect(() => {
    fetch("/api/doctor").catch(() => undefined);
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: ConfigCli[] = Array.isArray(d.clis) ? d.clis : [];
        setClis(list);
        const cfg = readCliConfig();
        const saved = cfg.cliId && list.some((c) => c.id === cfg.cliId && c.installed) ? cfg.cliId : "";
        const first = list.find((c) => c.installed)?.id ?? "";
        const active = saved || first;
        if (active) {
          setCliId(active);
          if (!saved) writeCliConfig({ cliId: active, mode: "cli" });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onStep = (e: Event) => {
      const idx = (e as CustomEvent<{ index: number }>).detail?.index ?? 0;
      if (idx >= 2) setWizardStep("cv");
      else if (idx >= 1) setWizardStep("cli");
    };
    window.addEventListener("co-tour-onboarding-step", onStep);
    return () => window.removeEventListener("co-tour-onboarding-step", onStep);
  }, []);

  const installedCount = useMemo(() => clis.filter((c) => c.installed).length, [clis]);
  const activeCli = clis.find((c) => c.id === cliId && c.installed);

  const selectCli = useCallback((id: string) => {
    setCliId(id);
    writeCliConfig({ cliId: id, mode: "cli" });
  }, []);

  return (
    <PageShell width="default">
      <div data-co-tour="welcome">
        <p className="md-eyebrow">Welcome</p>
        <h1 className="md-display-small-emphasized mt-2">Set up career-ops</h1>
        <p className="mt-2.5 max-w-[640px] text-[17px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          Two quick steps on your machine — connect an AI CLI, then add your CV as{" "}
          <code className="font-mono text-[14px]">cv.md</code>. Nothing is uploaded to us.
        </p>
      </div>

      <ol className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Setup steps">
        {(
          [
            { id: "cli" as const, n: 1, label: "Connect AI CLI" },
            { id: "cv" as const, n: 2, label: "Add your CV" },
          ] as const
        ).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setWizardStep(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
                wizardStep === s.id
                  ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                  : "border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]",
              )}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[11px] font-semibold">
                {s.n}
              </span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      {wizardStep === "cli" ? (
        <section className="mt-7" data-co-tour="cli">
          <h2 className="text-lg font-medium text-[var(--md-sys-color-on-surface)]">Which AI CLI do you use?</h2>
          <p className="mt-1 max-w-[640px] text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Used for job scoring, CV formatting, portal scans, and application drafts. Install one if none are detected — paste
            and <code className="font-mono text-[12px]">.md</code> files still work without it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
            {clis.map((c) => (
              <ConfigCliTile key={c.id} cli={c} selected={cliId === c.id} onSelect={() => selectCli(c.id)} />
            ))}
          </div>
          {activeCli ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              <MaterialSymbol name="check_circle" size={16} className="text-[var(--md-sys-color-primary)]" />
              {cliDisplayName(activeCli.id) ?? activeCli.name} ready at{" "}
              <code className="truncate font-mono text-[11px]">{activeCli.path ?? activeCli.id}</code>
            </p>
          ) : installedCount === 0 ? (
            <p className="mt-3 text-sm text-[var(--md-sys-color-on-tertiary-container)]">
              No CLI detected — you can still paste or drop a <code className="font-mono text-[12px]">.md</code> file on the next step.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Md3ActionButton variant="filled" icon="arrow_forward" onClick={() => setWizardStep("cv")}>
              {activeCli ? "Continue to CV" : "Continue without CLI"}
            </Md3ActionButton>
            <Link href="/config" className="md3-btn-text min-h-11 px-4 text-sm">
              Advanced config
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-7" data-co-tour="cv">
          <h2 className="text-lg font-medium text-[var(--md-sys-color-on-surface)]">Add your CV</h2>
          <p className="mt-1 max-w-[640px] text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Drop a PDF or <code className="font-mono text-[12px]">.md</code> file, or paste the text. PDF text is extracted locally
            {activeCli ? `, then ${cliDisplayName(activeCli.id) ?? activeCli.name} formats it` : " — no CLI needed for .md or paste"}.
            Review before saving.
          </p>
          <div className="mt-4">
            <CvIngest afterSave="home" cliId={cliId || null} />
          </div>
          <details className="mt-4 rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-[var(--md-sys-color-on-surface)]">How to get a .md or PDF file</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--md-sys-color-on-surface-variant)]">
              <li>
                <strong>LinkedIn:</strong> Profile → More → Save to PDF, then drop it here.
              </li>
              <li>
                <strong>Word / Google Docs:</strong> Download as PDF or Plain Text (.txt), then drop or paste.
              </li>
              <li>
                <strong>By hand:</strong> Copy headings from <code className="font-mono text-[12px]">examples/cv-example.md</code>{" "}
                — replace the fictional content with yours.
              </li>
              <li>
                Full guide:{" "}
                <a href="https://github.com/SaadNiaziDev/career-ops-public#how-to-get-cvmd-and-the-other-markdown-files" className="text-[var(--md-sys-color-primary)] underline">
                  README — markdown files
                </a>
              </li>
            </ul>
          </details>
          <button type="button" className="md3-btn-text mt-4 text-sm" onClick={() => setWizardStep("cli")}>
            ← Back to CLI setup
          </button>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/add" className="md3-btn-outlined min-h-11 px-4 text-sm">
          Skip — paste a job URL
        </Link>
        <Link href="/explore" className="md3-btn-text min-h-11 px-4 text-sm">
          Scan portals later
        </Link>
      </div>
    </PageShell>
  );
}
