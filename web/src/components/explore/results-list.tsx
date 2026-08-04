"use client";

import { useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { Button } from "@/components/ui/button";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import type { DiscoveredOffer } from "@/lib/explore";
import { CostBadge } from "@/components/cost/cost-badge";
import { DiscoveryCard } from "./discovery-card";
import { useExplore } from "./explore-provider";

export type EnrichedOffer = DiscoveredOffer & { inPipeline: boolean; evaluatedN?: string };

export function ResultsList({ offers }: { offers: EnrichedOffer[] }) {
  const { companiesScanned, partial, addToPipeline, added, mode } = useExplore();
  const isAi = mode === "ai";
  const [sort, setSort] = useState<"fresh" | "company">("fresh");
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = offers;
    if (needle) {
      list = list.filter(
        (o) => o.title.toLowerCase().includes(needle) || o.company.toLowerCase().includes(needle),
      );
    }
    return [...list].sort((a, b) =>
      sort === "fresh" ? (b.postedAt || "").localeCompare(a.postedAt || "") : a.company.localeCompare(b.company),
    );
  }, [offers, q, sort]);

  const addable = offers.filter((o) => !o.inPipeline && !o.evaluatedN && !added.has(o.url));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="mb-0 md-body-large text-[var(--md-sys-color-on-surface)]">
            <span className="font-medium">{offers.length}</span>{" "}
            {isAi ? `candidate${offers.length === 1 ? "" : "s"}` : `fresh role${offers.length === 1 ? "" : "s"}`}
            <CostBadge kind={isAi ? "spend" : "free-network"} size="xs" className="ml-2 align-middle" />
          </p>
          <p className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            {isAi
              ? "found by AI on the open web · unverified until you evaluate"
              : `${companiesScanned > 0 ? `${companiesScanned.toLocaleString()} companies scanned · ` : ""}0 tokens spent${partial ? " · some boards were unreachable (normal for public directories)" : ""}`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter results…"
            className="h-10 w-40 rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] px-3 md-body-small text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)]"
          />
          <Md3Segmented
            value={sort}
            onChange={setSort}
            aria-label="Sort results"
            options={[
              { value: "fresh", label: "Fresh" },
              { value: "company", label: "Company" },
            ]}
          />
          {addable.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => addToPipeline(addable)}>
              <MaterialSymbol name="add" size={16} />
              Add all {addable.length}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {view.map((o) => (
          <DiscoveryCard key={o.url} offer={o} inPipeline={o.inPipeline} evaluatedN={o.evaluatedN} />
        ))}
      </div>
    </div>
  );
}
