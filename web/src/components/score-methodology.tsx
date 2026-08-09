"use client";

import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Card } from "@/components/ui/md3-card";
import { WeightsReadout } from "@/components/config/weights-readout";

// Blueprint S03 · gap 6 — scoring used to be a collapsed footnote. It is a card
// in the decision rail now: the apply line, what each dimension means, the live
// weights, and the one link that can change them.

const DIMENSIONS: [string, string][] = [
  ["Match", "CV vs role requirements"],
  ["Career fit", "Alignment with your goals"],
  ["Comp", "Offer vs market (when data exists)"],
  ["Culture", "Team and ways of working"],
  ["Red flags", "Ghost jobs, scams, mismatches"],
  ["Overall", "Combined judgment → score"],
];

export function ScoreMethodology() {
  return (
    <Md3Card
      title={
        <span className="inline-flex items-center gap-2 md-title-small">
          <MaterialSymbol name="function" size={18} className="text-[var(--md-sys-color-primary)]" />
          How this was weighted
        </span>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
        Roles score <strong className="text-[var(--md-sys-color-on-surface)]">1.0–5.0</strong>.{" "}
        <strong className="text-[var(--md-sys-color-on-surface)]">4.0</strong> is the apply line — below it,
        career-ops recommends passing unless you have a specific reason.
      </p>

      <WeightsReadout title="Ranking weights" />

      <ul className="mt-3 list-disc space-y-1 border-t border-[var(--md-sys-color-outline-variant)] pl-4 pt-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
        {DIMENSIONS.map(([k, v]) => (
          <li key={k}>
            <strong className="text-[var(--md-sys-color-on-surface)]">{k}</strong> — {v}
          </li>
        ))}
      </ul>
    </Md3Card>
  );
}
