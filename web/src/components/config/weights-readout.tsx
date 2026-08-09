"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, WEIGHT_LABEL, type Weights } from "@/lib/weights";

/**
 * Read-only view of the ranking weights, with the one link that can change
 * them. Explore (S04 · redline 3) and Report (S03 · gap 6) both explain a
 * number with this; neither may edit it in place.
 */
export function WeightsReadout({ title = "Ranking weights" }: { title?: string }) {
  const [weights, setWeights] = useState<Weights | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/portals/weights")
      .then((r) => r.json())
      .then((d: { weights?: Weights }) => live && setWeights(d.weights ?? DEFAULT_WEIGHTS))
      .catch(() => live && setWeights({ ...DEFAULT_WEIGHTS }));
    return () => {
      live = false;
    };
  }, []);

  if (!weights) return null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <Link href="/config#profile" className="text-[11px] text-[var(--md-sys-color-primary)] hover:underline">
          Edit in Config
        </Link>
      </div>
      <div className="space-y-1.5">
        {WEIGHT_KEYS.map((k) => (
          <div key={k} className="weights-readout">
            <span className="truncate text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
              {WEIGHT_LABEL[k]}
            </span>
            <div className="weights-readout__track">
              <div className="weights-readout__bar" style={{ width: `${weights[k]}%` }} />
            </div>
            <span className="text-right font-mono text-[11px] tabular-nums text-[var(--md-sys-color-on-surface)]">
              {weights[k]}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--md-sys-color-outline)]">
        Read from <code className="font-mono">portals.yml → ranking.weights</code>.
      </p>
    </div>
  );
}
