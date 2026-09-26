"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ATS_LABEL, ATS_SOURCES, cleanChips, cleanRoleTitles, type AtsSource, type ExploreFilters } from "@/lib/explore";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { WeightsReadout } from "@/components/config/weights-readout";

const RECENCY = [
  { label: "24h", days: 1 },
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

const REMOTE_LOCATIONS = ["Remote", "Worldwide", "Anywhere", "Global", "Work from anywhere"];

function KeywordField({
  values,
  tone,
  placeholder,
  onChange,
}: {
  values: string[];
  tone: "inc" | "exc";
  placeholder: string;
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const collapsedLimit = 3;
  const canCollapse = values.length > collapsedLimit;
  const visibleValues = values.filter((value) => !query || value.toLowerCase().includes(query.trim().toLowerCase()));
  const displayedValues = expanded || query ? visibleValues : visibleValues.slice(0, collapsedLimit);
  // Split only on UNAMIGUOUS item separators (comma / newline / semicolon) — never
  // bare spaces, which are legitimate inside multi-word entries ("AI platform",
  // "New York", "Costa Rica"). A space-only paste stays one chip on purpose (#1147).
  const commit = (text: string) => {
    const parts = text.split(/[,\n;\t\r]+/);
    const next = tone === "inc" ? cleanRoleTitles([...values, ...parts]) : cleanChips([...values, ...parts]);
    onChange(next);
    setDraft("");
  };
  return (
    <div>
    <div className="md3-field h-auto min-h-[48px] flex-wrap items-center gap-1 py-2">
      {displayedValues.map((v) => (
        <span
          key={v}
          className="md3-chip inline-flex min-h-[32px] cursor-default items-center gap-1"
          data-active={tone === "inc" ? "true" : "false"}
        >
          {tone === "exc" && <MaterialSymbol name="block" size={14} className="opacity-70" />}
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="inline-flex opacity-60 transition-opacity hover:opacity-100 max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:items-center max-sm:justify-center"
          >
            <MaterialSymbol name="close" size={14} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const val = e.target.value;
          if (/[,\n;\t\r]$/.test(val)) commit(val);
          else setDraft(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text");
          const merged = draft + text;
          // Only commit to chips when the paste contains item separators.
          // A plain-text paste (e.g. pasting "-EMEA" after typing "Remote")
          // stays in the input field so the user can keep editing.
          if (/[,;\n\t\r]/.test(text)) commit(merged);
          else setDraft(merged);
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={values.length ? "" : placeholder}
        className="md3-field__input min-w-[7rem] flex-1 text-[13.5px]"
      />
    </div>
    {values.length > 0 && (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {canCollapse && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((current) => !current);
              setQuery("");
            }}
            className="inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-brand-text hover:text-foreground"
          >
            <MaterialSymbol name={expanded ? "expand_less" : "expand_more"} size={18} />
            {expanded ? "Show fewer" : `Show all ${values.length} ${tone === "inc" ? "roles" : "exclusions"}`}
          </button>
        )}
        <span className="text-xs text-muted" aria-live="polite">
          {query ? `${visibleValues.length} of ${values.length}` : `${values.length} ${tone === "inc" ? "roles" : "exclusions"}`}
        </span>
        {expanded && canCollapse && (
          <label className="flex min-h-[40px] flex-1 basis-full items-center gap-2 sm:basis-56">
            <MaterialSymbol name="search" size={17} className="text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${tone === "inc" ? "roles" : "exclusions"}`}
              aria-label={`Search ${tone === "inc" ? "roles" : "exclusions"}`}
              className="min-w-0 flex-1 border-b border-border bg-transparent py-1 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            onChange([]);
            setQuery("");
            setExpanded(false);
          }}
          className="inline-flex min-h-[40px] items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <MaterialSymbol name="delete_sweep" size={17} /> Clear all
        </button>
      </div>
    )}
    </div>
  );
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[13px] font-medium text-foreground">{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

export function FilterBuilder({
  filters,
  onChange,
  seededFrom = [],
}: {
  filters: ExploreFilters;
  onChange: (f: ExploreFilters) => void;
  seededFrom?: string[];
}) {
  const [advanced, setAdvanced] = useState(false);
  const set = (patch: Partial<ExploreFilters>) => onChange({ ...filters, ...patch });
  const toggleAts = (a: AtsSource) => {
    const has = filters.ats.includes(a);
    const next = has ? filters.ats.filter((x) => x !== a) : [...filters.ats, a];
    set({ ats: next.length ? next : filters.ats });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label hint={filters.positive.length === 0 ? "empty = every fresh posting" : undefined}>Roles to find</Label>
        <KeywordField values={filters.positive} tone="inc" placeholder="AI platform, ML infrastructure, staff engineer…" onChange={(v) => set({ positive: v })} />
        {seededFrom.length > 0 && filters.positive.length > 0 && (
          <p className="mt-1 text-[11px] text-faint">Seeded from your {seededFrom.join(" + ")} — edit freely.</p>
        )}
      </div>

      <div>
        <Label>Exclude</Label>
        <KeywordField values={filters.negative} tone="exc" placeholder="manager, sales, contract…" onChange={(v) => set({ negative: v })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-muted">Quick focus</span>
        <Md3Chip
          active={filters.alwaysAllow.length === 0 && REMOTE_LOCATIONS.every((location) => filters.allow.includes(location))}
          onClick={() => set({ allow: REMOTE_LOCATIONS, alwaysAllow: [] })}
        >
          <MaterialSymbol name="public" size={15} />
          Remote worldwide
        </Md3Chip>
        {filters.alwaysAllow.length > 0 && (
          <Md3Chip
            active={filters.alwaysAllow.length > 0 && REMOTE_LOCATIONS.every((location) => filters.allow.includes(location))}
            onClick={() => set({ allow: REMOTE_LOCATIONS })}
          >
            <MaterialSymbol name="home_work" size={15} />
            Home + remote
          </Md3Chip>
        )}
        {(filters.allow.length > 0 || filters.alwaysAllow.length > 0) && (
          <button type="button" onClick={() => set({ allow: [], alwaysAllow: [] })} className="text-[12px] text-muted hover:text-foreground">
            Clear location focus
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <Label hint="postings published in this window">
            <span className="inline-flex items-center gap-1.5">
              <MaterialSymbol name="schedule" size={16} className="text-muted" /> Posted within
            </span>
          </Label>
          <Md3Segmented
            value={String(filters.sinceDays)}
            onChange={(v) => set({ sinceDays: Number(v) })}
            aria-label="Posted within"
            options={RECENCY.map((r) => ({ value: String(r.days), label: r.label }))}
          />
        </div>

        <div>
          <Label hint={filters.ats.length === 0 ? "pick at least one" : undefined}>Sources</Label>
          <div className="flex flex-wrap gap-1.5">
            {ATS_SOURCES.map((a) => {
              const on = filters.ats.includes(a);
              return (
                <Md3Chip key={a} active={on} onClick={() => toggleAts(a)}>
                  {ATS_LABEL[a]}
                </Md3Chip>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/30 p-3">
        <WeightsReadout title="How results are ranked" />
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-foreground max-sm:min-h-[44px]"
      >
        <MaterialSymbol name="tune" size={16} />
        Location &amp; scope
        <MaterialSymbol name="expand_more" size={16} className={cn("transition-transform", advanced && "rotate-180")} />
      </button>

      {advanced && (
        <div className="space-y-3 rounded-xl border border-border bg-surface/30 p-3">
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <MaterialSymbol name="location_on" size={16} /> Location
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label hint="rescues multi-loc posts">Always include</Label>
              <KeywordField values={filters.alwaysAllow} tone="inc" placeholder="London…" onChange={(v) => set({ alwaysAllow: v })} />
            </div>
            <div>
              <Label>Only in</Label>
              <KeywordField values={filters.allow} tone="inc" placeholder="Remote, EMEA…" onChange={(v) => set({ allow: v })} />
            </div>
            <div>
              <Label>Never in</Label>
              <KeywordField values={filters.block} tone="exc" placeholder="India…" onChange={(v) => set({ block: v })} />
            </div>
          </div>
          <div>
            <Label hint={`${filters.limitPerAts} companies / source`}>Scan depth</Label>
            <input
              type="range"
              min={50}
              max={500}
              step={50}
              value={filters.limitPerAts}
              onChange={(e) => set({ limitPerAts: Number(e.target.value) })}
              className="w-full accent-brand"
            />
          </div>
        </div>
      )}
    </div>
  );
}
