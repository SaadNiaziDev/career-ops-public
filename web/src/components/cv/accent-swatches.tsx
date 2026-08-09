"use client";

import { useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

// Blueprint S07 · gap 6 — four curated swatches plus a custom entry, not a bare
// OS colour picker. Heading colour derives from the accent unless the user has
// overridden it, so one click restyles the whole document coherently.

export type AccentPreset = {
  name: string;
  accent: string;
  heading: string;
};

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Ink", accent: "#1a1a2e", heading: "#1a1a2e" },
  { name: "Oxford", accent: "#2563eb", heading: "#1a1a2e" },
  { name: "Rust", accent: "#97490b", heading: "#341100" },
  { name: "Forest", accent: "#2f5d50", heading: "#17302a" },
];

/** The heading tone a preset accent implies — a darkened version of the accent. */
export function derivedHeading(accent: string): string {
  const preset = ACCENT_PRESETS.find((p) => p.accent.toLowerCase() === accent.toLowerCase());
  if (preset) return preset.heading;

  const hex = accent.replace("#", "");
  if (hex.length !== 6) return accent;
  const dark = [0, 2, 4]
    .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.45))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `#${dark}`;
}

export function AccentSwatches({
  accent,
  onChange,
}: {
  accent: string;
  /** Emits both colours — the heading is always derived from the accent. */
  onChange: (next: { accent_color: string; heading_color: string }) => void;
}) {
  const [custom, setCustom] = useState(false);

  function pick(next: string) {
    onChange({ accent_color: next, heading_color: derivedHeading(next) });
  }

  const isPreset = ACCENT_PRESETS.some((p) => p.accent.toLowerCase() === accent.toLowerCase());

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium">Accent</span>
      <div className="flex flex-wrap items-center gap-2">
        {ACCENT_PRESETS.map((p) => {
          const active = p.accent.toLowerCase() === accent.toLowerCase();
          return (
            <button
              key={p.name}
              type="button"
              title={p.name}
              aria-label={`Accent ${p.name}`}
              aria-pressed={active}
              onClick={() => pick(p.accent)}
              className={cn(
                "size-9 rounded-full border-2 transition-transform",
                active
                  ? "border-[var(--md-sys-color-primary)] scale-105"
                  : "border-[var(--md-sys-color-outline-variant)]",
              )}
              style={{ background: p.accent }}
            />
          );
        })}
        <button
          type="button"
          onClick={() => setCustom((v) => !v)}
          aria-pressed={custom || !isPreset}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full border-2",
            custom || !isPreset
              ? "border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]"
              : "border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-outline)]",
          )}
          title="Custom colour"
          aria-label="Custom accent colour"
        >
          <MaterialSymbol name="colorize" size={18} />
        </button>
      </div>

      {(custom || !isPreset) && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input
            type="color"
            value={accent}
            onChange={(e) => pick(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded border border-[var(--md-sys-color-outline-variant)]"
            aria-label="Custom accent colour value"
          />
          <span className="font-mono text-[11px] text-[var(--md-sys-color-outline)]">{accent}</span>
        </label>
      )}

    </div>
  );
}
