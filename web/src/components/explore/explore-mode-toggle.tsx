"use client";

import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CostBadge } from "@/components/cost/cost-badge";
import type { CostClass } from "@/lib/explore-cost";
import { cn } from "@/lib/cn";

type ExploreMode = "scan" | "ai";

export function ExploreModeToggle({
  mode,
  onChange,
  cliConfigured,
}: {
  mode: ExploreMode;
  onChange: (m: ExploreMode) => void;
  cliConfigured: boolean;
}) {
  const items: { value: ExploreMode; label: string; icon: string; cost: CostClass }[] = [
    { value: "scan", label: "Scan", icon: "explore", cost: "free-network" },
    { value: "ai", label: "AI search", icon: "bolt", cost: "spend" },
  ];

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <div className="md3-segmented w-full sm:w-auto" role="group" aria-label="Explore mode">
        {items.map((item) => {
          const active = mode === item.value;
          return (
            <button
              key={item.value}
              type="button"
              className="md3-segmented-btn min-h-[44px]"
              data-active={active ? "true" : "false"}
              aria-pressed={active}
              onClick={() => onChange(item.value)}
            >
              <MaterialSymbol name={item.icon} size={18} filled={active} />
              <span className="md-label-large">{item.label}</span>
              <CostBadge kind={item.cost} size="xs" />
            </button>
          );
        })}
      </div>
      {!cliConfigured && mode === "ai" && (
        <p className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">needs a CLI</p>
      )}
    </div>
  );
}
