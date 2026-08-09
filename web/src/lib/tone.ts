// Semantic status tones as MD3 roles, never Tailwind literals.
// Blueprint 01 · Foundations: good → tertiary, caution → secondary,
// bad → error. Every score bar, verdict pill and legitimacy chip reads from
// here so a theme change moves all of them at once.

export type Tone = "good" | "warn" | "bad" | "muted";

/** Solid fill — score bars, dimension bars, dots. */
export const TONE_BAR: Record<Tone, string> = {
  good: "bg-[var(--md-sys-color-tertiary)]",
  warn: "bg-[var(--md-sys-color-secondary)]",
  bad: "bg-[var(--md-sys-color-error)]",
  muted: "bg-[var(--md-sys-color-primary)]",
};

/** Foreground only — numerals, section labels. */
export const TONE_TEXT: Record<Tone, string> = {
  good: "text-[var(--md-sys-color-tertiary)]",
  warn: "text-[var(--md-sys-color-secondary)]",
  bad: "text-[var(--md-sys-color-error)]",
  muted: "text-[var(--md-sys-color-on-surface)]",
};

/** Container pair — chips and pills that carry their own background. */
export const TONE_CHIP: Record<Tone, string> = {
  good: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
  warn: "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
  bad: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
  muted:
    "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]",
};

/** Outlined variant of the chip — used where chips sit on a container already. */
export const TONE_OUTLINE: Record<Tone, string> = {
  good: "border-[var(--md-sys-color-tertiary)]/40 bg-[var(--md-sys-color-tertiary-container)]/50 text-[var(--md-sys-color-on-tertiary-container)]",
  warn: "border-[var(--md-sys-color-secondary)]/40 bg-[var(--md-sys-color-secondary-container)]/50 text-[var(--md-sys-color-on-secondary-container)]",
  bad: "border-[var(--md-sys-color-error)]/40 bg-[var(--md-sys-color-error-container)]/50 text-[var(--md-sys-color-on-error-container)]",
  muted:
    "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]",
};

/** Verdict decision word → tone. Research reads as advisory, not a warning. */
export function decisionTone(decision: string): Tone {
  const d = decision.toLowerCase();
  if (d.includes("apply")) return "good";
  if (d.includes("skip") || d.includes("discard")) return "bad";
  if (d.includes("research")) return "muted";
  return "warn";
}
