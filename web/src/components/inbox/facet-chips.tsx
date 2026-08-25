"use client";

import type { ReactNode } from "react";
import type { AtsSource } from "@/lib/explore";
import { ATS_LABEL } from "@/lib/explore";
import { FRESHNESS_WINDOWS, SENIORITY_LABEL, type Seniority } from "@/lib/inbox";
import { CostBadge } from "@/components/cost/cost-badge";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Input } from "@/components/ui/md3-input";
import { Md3Select } from "@/components/ui/md3-select";

export type InboxSort = "newest" | "fit" | "company";

// Free, client-side facets over the raw firehose — 0 tokens, instant. Mirrors the
// Explore chip language so the two surfaces read as one system. On mobile the chip
// row scrolls INSIDE its own container (never the page).
export function FacetChips({
  within,
  setWithin,
  minFit,
  setMinFit,
  sources,
  toggleSource,
  seniorities,
  toggleSeniority,
  locQ,
  setLocQ,
  kw,
  setKw,
  sort,
  setSort,
  availSources,
  availSeniorities,
  resultCount,
  totalCount,
  anyActive,
  onClear,
}: {
  within: number | null;
  setWithin: (d: number | null) => void;
  minFit: number | null;
  setMinFit: (score: number | null) => void;
  sources: Set<AtsSource>;
  toggleSource: (s: AtsSource) => void;
  seniorities: Set<Seniority>;
  toggleSeniority: (s: Seniority) => void;
  locQ: string;
  setLocQ: (v: string) => void;
  kw: string;
  setKw: (v: string) => void;
  sort: InboxSort;
  setSort: (sort: InboxSort) => void;
  availSources: AtsSource[];
  availSeniorities: Seniority[];
  resultCount: number;
  totalCount: number;
  anyActive: boolean;
  onClear: () => void;
}) {
  return (
    <section className="pipeline-filter-bar" aria-label="Filter inbox roles">
      <div className="pipeline-filter-bar__top">
        <Md3Input
          icon="search"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="Search company or role"
          aria-label="Search company or role"
          className="pipeline-filter-search"
        />
        <span className="shrink-0 md-body-small text-[var(--md-sys-color-outline)]" aria-live="polite">
          <strong className="font-semibold tabular-nums text-[var(--md-sys-color-on-surface)]">{resultCount}</strong> of {totalCount} roles
        </span>
        {anyActive && (
          <button type="button" onClick={onClear} className="md3-btn-text shrink-0">
            <MaterialSymbol name="filter_alt_off" size={18} /> Clear filters
          </button>
        )}
      </div>

      <div className="pipeline-filter-grid">
        <FilterField label="Date added">
          <Md3Select
            value={within == null ? "any" : String(within)}
            onChange={(value) => setWithin(value === "any" ? null : Number(value))}
            options={[
              { value: "any", label: "Any date" },
              ...FRESHNESS_WINDOWS.map((w) => ({ value: String(w.days), label: `Last ${w.label}` })),
            ]}
            aria-label="Date added"
          />
        </FilterField>

        <FilterField label="Scanner fit">
          <Md3Select
            value={minFit == null ? "any" : String(minFit)}
            onChange={(value) => setMinFit(value === "any" ? null : Number(value))}
            options={[
              { value: "any", label: "Any fit" },
              { value: "60", label: "60+ fit" },
              { value: "58", label: "58+ fit" },
              { value: "55", label: "55+ fit" },
            ]}
            aria-label="Minimum scanner fit score"
          />
        </FilterField>

        <FilterField label="Location">
          <Md3Input
            icon="location_on"
            value={locQ}
            onChange={(e) => setLocQ(e.target.value)}
            placeholder="Lahore, remote…"
            aria-label="Filter by location"
            className="min-h-10"
          />
        </FilterField>

        <FilterField label="Sort by">
          <Md3Select
            value={sort}
            onChange={(value) => setSort(value as InboxSort)}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "fit", label: "Best fit first" },
              { value: "company", label: "Company A–Z" },
            ]}
            aria-label="Sort inbox roles"
          />
        </FilterField>
      </div>

      {(availSeniorities.length > 0 || availSources.length > 0) && (
        <div className="pipeline-filter-bar__facets">
          {availSeniorities.map((s) => (
            <Md3Chip key={s} active={seniorities.has(s)} onClick={() => toggleSeniority(s)}>
              {SENIORITY_LABEL[s]}
            </Md3Chip>
          ))}
          {availSources.map((s) => (
            <Md3Chip key={s} active={sources.has(s)} onClick={() => toggleSource(s)}>
              {ATS_LABEL[s]}
            </Md3Chip>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 md-body-small text-[var(--md-sys-color-outline)]">
            <CostBadge kind="free" size="xs" /> Filters use no tokens
          </span>
        </div>
      )}
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pipeline-filter-field">
      <span>{label}</span>
      {children}
    </div>
  );
}
