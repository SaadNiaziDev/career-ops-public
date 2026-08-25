"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { CvIngest } from "@/components/cv/cv-ingest";
import { cliDisplayName, readCliConfig } from "@/lib/cli-config";

export function FirstRunHome() {
  const [cliLine, setCliLine] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctor").catch(() => undefined);
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const cfg = readCliConfig();
        const list: { id: string; installed: boolean; path: string | null; name: string }[] = d.clis ?? [];
        const active = list.find((c) => c.id === cfg.cliId && c.installed) ?? list.find((c) => c.installed);
        if (active) setCliLine(`${cliDisplayName(active.id) ?? active.name} detected at ${active.path ?? active.id}`);
      })
      .catch(() => undefined);
  }, []);

  return (
    <PageShell width="default">
      <p className="md-eyebrow">Welcome</p>
      <h1 className="md-display-small-emphasized mt-2">Start with your CV</h1>
      <p className="mt-2.5 max-w-[640px] text-[17px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
        Drop a PDF or a <code className="font-mono text-[14px]">.md</code> file — we turn it into{" "}
        <code className="font-mono text-[14px]">cv.md</code> on this machine. You review before anything is saved.
        Nothing leaves your laptop.
      </p>

      <div className="mt-7">
        <CvIngest afterSave="home" />
      </div>

      <p className="mt-4 text-sm text-[var(--md-sys-color-outline)]">
        Need a format guide? Copy the headings from{" "}
        <code className="font-mono text-[12px]">examples/cv-example.md</code> — don&apos;t copy the fictional content.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/add" className="md3-btn-outlined min-h-11 px-4 text-sm">
          Skip — paste a job URL
        </Link>
        <Link href="/explore" className="md3-btn-text min-h-11 px-4 text-sm">
          Scan portals later
        </Link>
      </div>

      {cliLine && (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container-high)] px-5 py-4">
          <MaterialSymbol name="terminal" size={24} className="text-[var(--md-sys-color-primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{cliLine}</p>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Optional — used later to score jobs and draft applications. Your CV is saved without it.
            </p>
          </div>
          <Link href="/config" className="md3-btn-text text-sm">
            Open Config
          </Link>
        </div>
      )}
    </PageShell>
  );
}
