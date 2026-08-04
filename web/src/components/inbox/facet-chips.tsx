"use client";

import type { AtsSource } from "@/lib/explore";
import { ATS_LABEL } from "@/lib/explore";
import { FRESHNESS_WINDOWS, SENIORITY_LABEL, type Seniority } from "@/lib/inbox";
import { CostBadge } from "@/components/cost/cost-badge";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Input } from "@/components/ui/md3-input";

// Free, client-side facets over the raw firehose — 0 tokens, instant. Mirrors the
// Explore chip language so the two surfaces read as one system. On mobile the chip
// row scrolls INSIDE its own container (never the page).
export function FacetChips({
  within,
  setWithin,
  sources,
  toggleSource,
  seniorities,
  toggleSeniority,
  locQ,
  setLocQ,
  kw,
  setKw,
  availSources,
  availSeniorities,
  resultCount,
  totalCount,
  anyActive,
  onClear,
}: {
  within: number | null;
  setWithin: (d: number | null) => void;
  sources: Set<AtsSource>;
  toggleSource: (s: AtsSource) => void;
  seniorities: Set<Seniority>;
  toggleSeniority: (s: Seniority) => void;
  locQ: string;
  setLocQ: (v: string) => void;
  kw: string;
  setKw: (v: string) => void;
  availSources: AtsSource[];
  availSeniorities: Seniority[];
  resultCount: number;
  totalCount: number;
  anyActive: boolean;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2.5">
      {/* keyword search + live count */}
      <div className="flex items-center gap-3">
        <Md3Input
          icon="search"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="Filter by company or role…"
          className="flex-1"
        />
        <span className="shrink-0 text-xs text-muted">
          <span className="tabular-nums text-foreground">{resultCount}</span>
          <span className="text-faint">/{totalCount}</span>
        </span>
      </div>

      {/* chip row — desktop wraps, mobile scrolls inside the container */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {/* freshness (single-select segmented; click active to clear) */}
        <div className="md3-segmented inline-flex shrink-0">
          {FRESHNESS_WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              onClick={() => setWithin(within === w.days ? null : w.days)}
              className="md3-segmented-btn min-h-[44px] shrink-0"
              data-active={within === w.days ? "true" : "false"}
              aria-pressed={within === w.days}
            >
              {w.label}
            </button>
          ))}
        </div>

        {availSources.map((s) => (
          <Md3Chip key={s} active={sources.has(s)} onClick={() => toggleSource(s)}>
            {ATS_LABEL[s]}
          </Md3Chip>
        ))}

        {availSeniorities.map((s) => (
          <Md3Chip key={s} active={seniorities.has(s)} onClick={() => toggleSeniority(s)}>
            {SENIORITY_LABEL[s]}
          </Md3Chip>
        ))}

        {/* location contains */}
        <label className="md3-field w-28 shrink-0 py-1">
          <input
            value={locQ}
            onChange={(e) => setLocQ(e.target.value)}
            placeholder="location…"
            className="md3-field__input text-xs"
          />
        </label>

        {anyActive && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 text-xs text-faint transition-colors hover:text-foreground max-sm:min-h-[44px]"
          >
            <MaterialSymbol name="close" size={14} /> Clear
          </button>
        )}
      </div>

      {/* Token-honesty is bidirectional: the "free" reassurance is as always-visible
          as the tray's "spend" cue (mobile + desktop) — never desktop-only. */}
      <div className="flex items-center gap-1.5">
        <CostBadge kind="free" size="xs" />
        <span className="text-[11px] text-faint">Filtering is free — only scoring uses tokens.</span>
      </div>
    </div>
  );
}
