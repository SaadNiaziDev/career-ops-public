"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { cliDisplayName, readCliConfig } from "@/lib/cli-config";

export function FirstRunHome() {
  const [cliLine, setCliLine] = useState<string | null>(null);

  useEffect(() => {
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
      <h1 className="md-display-small-emphasized mt-2">Nothing tracked yet</h1>
      <p className="mt-2.5 max-w-[620px] text-[17px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
        Three ways in. Everything here is free until you ask for a score — that is the only step that spends tokens.
      </p>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <EntryCard
          icon="link"
          title="Paste a job URL"
          body="The fastest start. Drops one role into the inbox, parsed but unscored."
          href="/add"
          cta="Paste a link"
          filled
        />
        <EntryCard
          icon="radar"
          title="Scan the portals"
          body="Six ATS boards, no API keys, results stream in as they are found."
          href="/explore"
          cta="Run a scan"
          badge="FREE"
        />
        <EntryCard
          icon="description"
          title="Add your CV first"
          body="Scores and application drafts are only as good as what it knows about you."
          href="/cv"
          cta="Upload a CV"
        />
      </div>

      {cliLine && (
        <div className="mt-auto flex flex-wrap items-center gap-4 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container-high)] px-5 py-4">
          <MaterialSymbol name="terminal" size={24} className="text-[var(--md-sys-color-primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{cliLine}</p>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Set as the default agent. Change it any time in Config.</p>
          </div>
          <Link href="/config" className="md3-btn-text text-sm">
            Open Config
          </Link>
        </div>
      )}
    </PageShell>
  );
}

function EntryCard({
  icon,
  title,
  body,
  href,
  cta,
  filled,
  badge,
}: {
  icon: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  filled?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex flex-col rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] p-6">
      <span className="grid size-14 place-items-center rounded-[18px] bg-[var(--md-sys-color-secondary-container)]">
        <MaterialSymbol name={icon} size={28} className="text-[var(--md-sys-color-on-secondary-container)]" />
      </span>
      <p className="mt-4 text-[19px] font-semibold leading-snug">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--md-sys-color-outline)]">{body}</p>
      <Link
        href={href}
        className={`mt-auto inline-flex min-h-12 items-center justify-center gap-2 pt-5 ${filled ? "md3-btn-filled w-full" : "md3-btn-outlined w-full"}`}
      >
        {cta}
        {badge && (
          <span className="rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 text-[11px] font-semibold text-[var(--md-sys-color-on-tertiary-container)]">
            {badge}
          </span>
        )}
      </Link>
    </div>
  );
}
