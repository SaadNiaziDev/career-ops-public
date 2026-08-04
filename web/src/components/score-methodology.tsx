"use client";

import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Collapse } from "@/components/ui/md3-collapse";

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
    <Md3Collapse
      title={
        <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <MaterialSymbol name="help" size={14} className="mr-1.5 inline align-text-bottom" />
          How scoring works
        </span>
      }
    >
      <div className="dossier-inset-stack pb-1">
        <p className="mb-0 text-xs leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          Roles score <strong className="text-[var(--md-sys-color-on-surface)]">1.0–5.0</strong>.{" "}
          <strong className="text-[var(--md-sys-color-on-surface)]">4.0</strong> is the apply line — below it,
          career-ops recommends passing unless you have a specific reason.
        </p>
        <ul className="m-0 list-disc space-y-1 pl-4 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {DIMENSIONS.map(([k, v]) => (
            <li key={k}>
              <strong className="text-[var(--md-sys-color-on-surface)]">{k}</strong> — {v}
            </li>
          ))}
        </ul>
        <Link href="https://career-ops.org/methodology" target="_blank" rel="noreferrer" className="text-xs">
          Full methodology →
        </Link>
      </div>
    </Md3Collapse>
  );
}
