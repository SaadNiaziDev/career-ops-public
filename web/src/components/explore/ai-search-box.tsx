"use client";

import { useRef } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CostBadge } from "@/components/cost/cost-badge";

const EXAMPLES = [
  "AI infra roles at climate startups, remote EU",
  "Forward-deployed engineer at Series A devtools, US-remote",
  "Head of Applied AI at healthtech, posted this week",
];

export function AiSearchBox({
  intent,
  onIntent,
  onSubmit,
  cliConfigured,
  cliName,
  onRunScan,
}: {
  intent: string;
  onIntent: (s: string) => void;
  onSubmit: () => void;
  cliConfigured: boolean;
  cliName?: string;
  onRunScan: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const t = ref.current;
    if (t) {
      t.style.height = "auto";
      t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
    }
  };

  return (
    <div>
      <div className="rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-primary-container)] bg-[var(--md-sys-color-surface-container)] p-6 transition-[border-color,box-shadow] duration-300 focus-within:border-[var(--md-sys-color-primary)] focus-within:shadow-[0_0_0_1px_var(--md-sys-color-primary)]">
        <div className="mb-3 flex items-center gap-2 md-label-large text-[var(--md-sys-color-primary)]">
          <MaterialSymbol name="auto_awesome" size={18} />
          Describe the role — an AI hunts the open web for it
        </div>
        <textarea
          ref={ref}
          rows={2}
          value={intent}
          onChange={(e) => {
            onIntent(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (intent.trim()) onSubmit();
            }
          }}
          placeholder="“AI infra at climate startups, remote EU, not staff-level” — plain language, your words"
          className="w-full resize-none border-none bg-transparent text-lg leading-7 text-[var(--md-sys-color-on-surface)] outline-none placeholder:text-[var(--md-sys-color-outline)]"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            {cliConfigured ? (
              <>
                Reads the public web with <span className="text-[var(--md-sys-color-on-surface)]">{cliName || "your CLI"}</span> — it costs your tokens.
              </>
            ) : (
              "Connect an AI CLI in Config to use AI search."
            )}
          </span>
          <button
            type="button"
            disabled={!intent.trim()}
            onClick={onSubmit}
            className="md3-btn-filled disabled:opacity-50"
          >
            Search the open web
            <CostBadge kind="spend" size="xs" />
            <MaterialSymbol name="arrow_forward" size={18} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onIntent(ex)}
            className="md3-chip min-h-[40px] rounded-[var(--md-sys-shape-corner-full)]"
          >
            {ex}
          </button>
        ))}
        <button
          type="button"
          onClick={onRunScan}
          className="md3-btn-text ml-auto md-body-small"
        >
          or run the free Scan instead →
        </button>
      </div>
    </div>
  );
}
