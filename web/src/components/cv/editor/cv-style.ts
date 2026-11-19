import type { CvPageFormat } from "@/lib/cv/page";

export type CvStyle = {
  accent_color: string;
  heading_color: string;
  font_stack: string;
  margin: string;
  density: string;
};

export type CvSettings = {
  template: string;
  source: string;
  pageFormat: CvPageFormat;
  style: CvStyle;
  templates: { name: string; displayName: string }[];
};

export type CvSourceEntry = { path: string; label: string; exists: boolean; mtime: number };

export type ViewMode = "edit" | "split" | "preview";

/** Mirrors DEFAULT_CV_STYLE in lib/cv/settings.ts (server-only: it imports node:fs). */
export const DEFAULT_STYLE: CvStyle = {
  accent_color: "#2563eb",
  heading_color: "#1a1a2e",
  font_stack: "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif",
  margin: "2px 0",
  density: "standard",
};

/** Families headless Chromium reliably has, so the preview and the printed PDF agree. */
export const FONT_PRESETS = [
  { value: "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif", label: "Sans — Liberation / Arial" },
  { value: "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif", label: "Sans — DejaVu" },
  { value: "'Liberation Serif', 'Times New Roman', serif", label: "Serif — Liberation / Times" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif — Georgia" },
];

export const MARGIN_PRESETS = [
  { value: "0", label: "Tight" },
  { value: "2px 0", label: "Default" },
  { value: "10px 0", label: "Roomy" },
];

export function sameStyle(a: CvStyle, b: CvStyle): boolean {
  return (Object.keys(DEFAULT_STYLE) as (keyof CvStyle)[]).every((k) => a[k] === b[k]);
}
