"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { CostBadge } from "@/components/cost/cost-badge";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { cn } from "@/lib/cn";

export type ShortItem = { url: string; company: string; role: string };

function fmtTokens(t: number): string {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`;
  if (t >= 1_000) return `${Math.round(t / 1_000)}k`;
  return `${t}`;
}

// The persistent shortlist tray — bottom-sheet on mobile (thumb-zone), floating card
// on desktop. "Score shortlist" is the ONLY token spend in the whole inbox: cost is
// shown BEFORE the click and gated behind an explicit confirm (never spend by surprise).
export function ShortlistTray({
  items,
  estimate,
  hasCli,
  onRemove,
  onClear,
  onScore,
}: {
  items: ShortItem[];
  estimate: { tokens?: number; usd?: number };
  hasCli: boolean;
  onRemove: (url: string) => void;
  onClear: () => void;
  onScore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (items.length === 0) return null;

  const n = items.length;
  const costText = estimate.tokens
    ? `≈ ${fmtTokens(estimate.tokens)} tokens${estimate.usd != null ? ` · ≈ $${estimate.usd.toFixed(2)}` : ""}`
    : "uses your tokens";

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 sm:bottom-4">
      <div className="mx-auto max-w-[var(--page-width-wide)] px-4 sm:px-6 lg:px-8">
        <div className="border-t border-border bg-surface shadow-lg shadow-black/10 sm:rounded-2xl sm:border">
          {/* expandable saved-items list */}
          {open && (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto px-3 py-1">
              {items.map((it) => (
                <li key={it.url} className="flex items-center gap-2.5 py-2">
                  <CompanyLogo name={it.company} size={18} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{it.company}</span> <span className="text-muted">· {it.role}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(it.url)}
                    aria-label={`Remove ${it.company}`}
                    className="inline-flex items-center justify-center rounded-md p-1 text-faint transition-colors hover:text-foreground max-sm:min-h-[44px] max-sm:min-w-[44px]"
                  >
                    <MaterialSymbol name="close" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* the persistent bar */}
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-medium max-sm:min-h-[44px]"
            >
              <MaterialSymbol
                name="expand_more"
                size={18}
                className={cn("text-muted transition-transform", open && "rotate-180")}
              />
              Shortlist <span className="tabular-nums text-brand-text">({n})</span>
            </button>

            {open && (
              <button type="button" onClick={onClear} className="text-xs text-faint transition-colors hover:text-foreground max-sm:min-h-[44px]">
                Clear
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {!confirming ? (
                <Md3ActionButton variant="filled" icon="auto_awesome" cost="spend" onClick={() => setConfirming(true)}>
                  Score {n}
                  <span className="hidden text-xs font-normal opacity-80 sm:inline">· {costText}</span>
                </Md3ActionButton>
              ) : (
                <ConfirmScore n={n} costText={costText} hasCli={hasCli} onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onScore(); }} />
              )}
            </div>
          </div>

          {/* cost line — always visible on mobile (where it doesn't fit in the button) */}
          <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5 text-[11px] text-muted sm:hidden">
            <CostBadge kind="spend" size="xs" />
            <span>{costText} — the only step that spends</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmScore({
  n,
  costText,
  hasCli,
  onCancel,
  onConfirm,
}: {
  n: number;
  costText: string;
  hasCli: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!hasCli) {
    return (
      <div className="md3-actions-row text-xs">
        <span className="text-muted">No AI configured.</span>
        <Link href="/config" className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-3 py-1.5 font-medium text-brand max-sm:min-h-[44px]">
          <MaterialSymbol name="settings" size={16} /> Set up
        </Link>
        <Md3ActionButton variant="text" onClick={onCancel}>
          Cancel
        </Md3ActionButton>
      </div>
    );
  }
  return (
    <div className="md3-actions-row">
      <span className="hidden items-center gap-1 text-[11px] text-muted sm:inline-flex">
        <CostBadge kind="spend" size="xs" /> {costText}
      </span>
      <Md3ActionButton variant="filled" icon="auto_awesome" cost="spend" onClick={onConfirm}>
        Score {n} now
      </Md3ActionButton>
      <Md3ActionButton variant="text" onClick={onCancel}>
        Cancel
      </Md3ActionButton>
    </div>
  );
}
