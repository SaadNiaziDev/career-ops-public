"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collect, fingerprint, issueBody, issueUrl, type Diag } from "@/lib/report/report";
import { MaterialSymbol } from "@/components/material-symbol";
import { Button, buttonVariants } from "@/components/ui/button";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { Md3Textarea } from "@/components/ui/md3-input";
import { cn } from "@/lib/cn";
import "@/lib/report/logbuf"; // install the client error ring-buffer (side-effect)

type SimilarIssue = { number: number; title: string; url: string };

// Dupe-deflection at write (the maintainer's #1 triage cost): search open
// issues client-side via GitHub's public search API — no key, no server of
// ours. Best-effort: rate-limited or offline → silently no suggestions.
const searchCache = new Map<string, SimilarIssue[]>();
async function searchIssues(q: string): Promise<SimilarIssue[]> {
  const cached = searchCache.get(q);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?per_page=4&q=${encodeURIComponent(`repo:santifer/career-ops is:issue is:open ${q}`)}`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) return [];
    const d = await res.json();
    const items: SimilarIssue[] = (d.items || []).map((i: { number: number; title: string; html_url: string }) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
    }));
    searchCache.set(q, items);
    return items;
  } catch {
    return [];
  }
}

// Beta/RC differentiator: a small version+channel pill (only on a pre-release
// channel) + a one-click "Report a bug" that opens a PRE-FILLED GitHub issue. No
// telemetry to any server (local-first / firewall) — the user reviews the exact,
// PII-scrubbed payload (preview-then-confirm) and clicks to open the issue himself.
export function BetaBanner() {
  const [meta, setMeta] = useState<{ version: string; channel: string; sha: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [similar, setSimilar] = useState<SimilarIssue[]>([]);
  const [searching, setSearching] = useState(false);

  // Text search is behind an EXPLICIT click, never as-you-type: the user's
  // words (which can name a company) must not reach api.github.com at keystroke
  // time — that would break the banner's "nothing is sent until you click"
  // pledge, and scrub() is a path/secret scrubber, not a free-text one, so it
  // could not remove the company name anyway. The click IS the consent.
  const checkExisting = async () => {
    const words = desc.trim().split(/\s+/).slice(0, 6).join(" ");
    if (!words) return;
    setSearching(true);
    const found = await searchIssues(`label:web-alpha ${words}`);
    setSearching(false);
    if (found.length) setSimilar(found);
  };

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then((d) => {
        if (d?.channel && d.channel !== "stable") setMeta(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openReport = async () => {
    const d = await collect();
    setDiag(d);
    setOpen(true);
    // One exact-match search by fingerprint: same bug already filed → the
    // strongest dedupe signal, shown before the user types a word.
    searchIssues(`in:body "${fingerprint(d)}"`).then((found) => {
      if (found.length) setSimilar(found);
    });
  };

  if (!meta) return null;

  return (
    <>
      <div className="fixed bottom-3 left-3 z-[70] flex items-center gap-2 rounded-full border border-brand/30 bg-surface/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
        <span className="flex items-center gap-1.5 font-medium text-brand-text">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" /> {meta.version} · {meta.channel}
        </span>
        {meta.sha ? <span className="hidden font-mono text-faint sm:inline">{meta.sha}</span> : null}
        <button
          type="button"
          onClick={() => void openReport()}
          className="ml-1 inline-flex items-center justify-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand-text transition-colors hover:bg-brand/15 max-sm:min-h-[44px]"
        >
          <MaterialSymbol name="bug_report" size={14} /> Report a bug
        </button>
      </div>

      {open && diag ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Report a bug"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-[var(--bg)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <MaterialSymbol name="bug_report" size={18} className="text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Report a bug · {diag.channel}</h2>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-on-surface)]"
              >
                <MaterialSymbol name="close" size={18} />
              </Button>
            </div>
            <Md3Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              autoFocus
              placeholder="What were you doing, and what went wrong?"
              className="w-full"
            />
            {desc.trim().split(/\s+/).length >= 3 ? (
              <button
                type="button"
                onClick={() => void checkExisting()}
                disabled={searching}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-brand disabled:opacity-60"
              >
                {searching ? (
                  <MaterialSymbol name="progress_activity" size={14} className="animate-spin" />
                ) : (
                  <MaterialSymbol name="search" size={14} />
                )}{" "}
                Check for existing reports first
              </button>
            ) : null}
            <Md3Collapse
              className="mt-3 rounded-lg border border-border bg-surface/40"
              title={
                <span className="text-xs font-medium text-muted">Exactly what gets attached — review before sending ↓</span>
              }
            >
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted">
                {issueBody(diag, desc)}
              </pre>
            </Md3Collapse>
            {similar.length > 0 ? (
              <div className="md3-alert md3-alert--warning mt-3 flex-col items-stretch">
                <p className="mb-0 text-xs font-medium">
                  Already reported? A 👍 on an existing issue beats a duplicate:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {similar.map((s) => (
                    <li key={s.number}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground underline-offset-2 transition-colors hover:text-brand hover:underline"
                      >
                        <MaterialSymbol name="thumb_up" size={14} className="shrink-0 text-[var(--md-sys-color-tertiary)]" />
                        <span className="font-mono">#{s.number}</span> {s.title.slice(0, 60)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-faint">
              <MaterialSymbol name="verified_user" size={16} className="mt-px shrink-0 text-[var(--md-sys-color-tertiary)]" />{" "}
              Opens a GitHub issue you confirm — nothing is sent until you click. NEVER includes your CV, profile,
              application answers, or job URLs.
            </p>
            <div className="md3-actions-row mt-4 justify-end">
              <Button variant="text" size="sm" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <a
                href={issueUrl(diag, desc)}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
              >
                <MaterialSymbol name="bug_report" size={18} />
                Open GitHub issue
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
