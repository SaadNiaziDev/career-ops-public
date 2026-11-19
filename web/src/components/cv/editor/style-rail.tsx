"use client";

import { useMemo } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { Button } from "@/components/ui/button";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Select } from "@/components/ui/md3-select";
import { AccentSwatches } from "@/components/cv/accent-swatches";
import type { CvPageFormat, PageBox } from "@/lib/cv/page";
import type { FitVerdict } from "@/lib/cv/fit";
import { DEFAULT_STYLE, FONT_PRESETS, MARGIN_PRESETS, sameStyle, type CvSettings, type CvStyle } from "./cv-style";

/** Page size, colour, typeface, density and padding for tailored CVs, plus "fit to one page". */
export function StyleRail({ settings, onChange, dirty, saving, onSave, fit, box, canUndoFit, onFit, onUndoFit }: {
  settings: CvSettings;
  onChange: (next: CvSettings) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  fit: FitVerdict;
  box: PageBox;
  canUndoFit: boolean;
  onFit: () => void;
  onUndoFit: () => void;
}) {
  const setStyle = <K extends keyof CvStyle>(key: K, value: CvStyle[K]) => onChange({ ...settings, style: { ...settings.style, [key]: value } });
  const fontOptions = useMemo(() => {
    const current = settings.style.font_stack;
    return !current || FONT_PRESETS.some((f) => f.value === current) ? FONT_PRESETS : [...FONT_PRESETS, { value: current, label: "Custom (from profile.yml)" }];
  }, [settings.style.font_stack]);

  return (
    <aside className="cv-studio__rail">
      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Changes preview instantly. Save to use them for every tailored PDF.</p>

      <span className="mb-1 block text-xs font-medium">Page size</span>
      <Md3Segmented<CvPageFormat>
        className="mb-4"
        value={settings.pageFormat}
        onChange={(v) => onChange({ ...settings, pageFormat: v })}
        aria-label="Page size"
        options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }]}
      />

      <div className="mb-4">
        <AccentSwatches accent={settings.style.accent_color} onChange={(next) => onChange({ ...settings, style: { ...settings.style, ...next } })} />
      </div>

      <span className="mb-1 block text-xs font-medium">Typeface</span>
      <Md3Select value={settings.style.font_stack} onChange={(v) => setStyle("font_stack", v)} options={fontOptions} aria-label="CV typeface" className="mb-3 w-full" />

      <span className="mb-1 block text-xs font-medium">Density</span>
      <Md3Segmented
        className="mb-3"
        value={settings.style.density}
        onChange={(v) => setStyle("density", v)}
        aria-label="CV density"
        options={[{ value: "compact", label: "Compact" }, { value: "standard", label: "Standard" }, { value: "spacious", label: "Spacious" }]}
      />

      <span className="mb-1 block text-xs font-medium">Page padding</span>
      <Md3Segmented value={settings.style.margin} onChange={(v) => setStyle("margin", v)} aria-label="CV page padding" options={MARGIN_PRESETS} />

      <Button variant={dirty ? "primary" : "outline"} size="sm" className="mt-4 w-full" onClick={onSave} disabled={!dirty || saving}>
        {saving && <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />}
        {saving ? "Saving" : dirty ? "Save style" : "Style saved"}
      </Button>
      <button
        type="button"
        className="mt-2 w-full text-center text-[11px] text-[var(--md-sys-color-primary)] hover:underline disabled:opacity-40"
        disabled={sameStyle(settings.style, DEFAULT_STYLE)}
        onClick={() => onChange({ ...settings, style: { ...DEFAULT_STYLE } })}
      >
        Reset style to defaults
      </button>

      {(canUndoFit || fit.proposal) && (
        <div className="rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container-high)] p-3">
          <p className="mb-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">{fit.message} at {box.label}.</p>
          {canUndoFit ? (
            <Button variant="outline" size="sm" className="w-full" onClick={onUndoFit}>
              <MaterialSymbol name="undo" size={16} />
              Undo fit
            </Button>
          ) : (
            <Button variant="primary" size="sm" className="w-full" onClick={onFit}>Fit to one page</Button>
          )}
        </div>
      )}
    </aside>
  );
}
