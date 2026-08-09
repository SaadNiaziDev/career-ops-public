"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { Button } from "@/components/ui/button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Select } from "@/components/ui/md3-select";
import { cvReadiness } from "@/lib/cv/quality";
import type { CvPreviewStats } from "@/lib/cv/preview";
import { cn } from "@/lib/cn";

type CvStyle = {
  accent_color: string;
  heading_color: string;
  font_stack: string;
  margin: string;
  density: string;
};

type CvSettings = {
  template: string;
  source: string;
  style: CvStyle;
  templates: { name: string; displayName: string }[];
};

type CvSourceEntry = { path: string; label: string; exists: boolean; mtime: number };

type ViewMode = "edit" | "split" | "preview";

// Mirrors DEFAULT_CV_STYLE in lib/cv/settings.ts (server-only: it imports node:fs).
const DEFAULT_STYLE: CvStyle = {
  accent_color: "#2563eb",
  heading_color: "#1a1a2e",
  font_stack: "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif",
  margin: "2px 0",
  density: "standard",
};

// Stacks limited to families Playwright's headless Chromium reliably has, so the
// on-screen preview and the printed PDF agree.
const FONT_PRESETS = [
  { value: "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif", label: "Sans — Liberation / Arial" },
  { value: "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif", label: "Sans — DejaVu" },
  { value: "'Liberation Serif', 'Times New Roman', serif", label: "Serif — Liberation / Times" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif — Georgia" },
];

// US Letter at 96dpi — the width the CV templates lay out against.
const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;

const MARGIN_PRESETS = [
  { value: "0", label: "Tight" },
  { value: "2px 0", label: "Default" },
  { value: "10px 0", label: "Roomy" },
];

function sameStyle(a: CvStyle, b: CvStyle): boolean {
  return (Object.keys(DEFAULT_STYLE) as (keyof CvStyle)[]).every((k) => a[k] === b[k]);
}

export function CvEditor() {
  const [content, setContent] = useState("");
  const [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState<CvSettings | null>(null);
  const [styleBaseline, setStyleBaseline] = useState<{ template: string; style: CvStyle } | null>(null);
  const [savingStyle, setSavingStyle] = useState(false);

  const [sources, setSources] = useState<CvSourceEntry[]>([]);
  const [activeSource, setActiveSource] = useState("cv.md");
  const [switching, setSwitching] = useState(false);
  const [importing, setImporting] = useState(false);

  const [view, setView] = useState<ViewMode>("split");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewStats, setPreviewStats] = useState<CvPreviewStats | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [previewScale, setPreviewScale] = useState(1);
  const [previewDocHeight, setPreviewDocHeight] = useState(PAGE_HEIGHT_PX);

  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewAbort = useRef<AbortController | null>(null);
  const previewKey = useRef("");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = content !== baseline;
  const styleDirty = !!(settings && styleBaseline && (settings.template !== styleBaseline.template || !sameStyle(settings.style, styleBaseline.style)));
  const readiness = useMemo(() => cvReadiness(content), [content]);

  // The renderer is a deterministic section parser (cv-md-preview.mjs); its own report
  // of what it found beats guessing from the markdown which headings it understood.
  const parseHint = useMemo(() => {
    if (!previewStats) return "";
    const { summary, experience, projects, education, skills, competencies } = previewStats;
    if (!summary && !experience && !projects && !education && !skills && !competencies) {
      return "Only the header could be parsed. The renderer reads ## Professional Summary, ## Experience, ## Skills and ## Education headings.";
    }
    if (!experience) return "No roles parsed — under ## Experience, start each role with ### Company — Location.";
    if (!skills && !competencies) return "No skills parsed — add a ## Skills section.";
    return "";
  }, [previewStats]);

  // ── data ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    Promise.all([fetch("/api/cv"), fetch("/api/cv/settings"), fetch("/api/cv/sources")])
      .then(async ([cvRes, settingsRes, sourcesRes]) => {
        if (!alive) return;
        if (cvRes.ok) {
          const d = await cvRes.json();
          setContent(d.content ?? "");
          setBaseline(d.content ?? "");
          setExists(d.exists ?? false);
          setActiveSource(d.source ?? "cv.md");
        } else {
          setError("Couldn't load your CV file.");
        }
        if (settingsRes.ok) {
          const s = (await settingsRes.json()) as CvSettings;
          setSettings(s);
          setStyleBaseline({ template: s.template, style: s.style });
        }
        if (sourcesRes.ok) {
          const src = await sourcesRes.json();
          setSources(src.sources ?? []);
        }
      })
      .catch(() => alive && setError("Couldn't reach the local server."))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      previewAbort.current?.abort();
    };
  }, []);

  // ── live preview ────────────────────────────────────────────────────────────
  const runPreview = useCallback(async (md: string, s: CvSettings) => {
    const key = JSON.stringify([md, s.template, s.style]);
    if (key === previewKey.current) return;
    previewKey.current = key;

    previewAbort.current?.abort();
    const ac = new AbortController();
    previewAbort.current = ac;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/cv/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: md, template: s.template, style: s.style }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (ac.signal.aborted) return;
      if (!res.ok) {
        previewKey.current = "";
        setPreviewError(data.error || "Preview failed");
        setPreviewHtml("");
        setPreviewStats(null);
        return;
      }
      setPreviewError("");
      setPreviewHtml(data.html ?? "");
      setPreviewStats(data.stats ?? null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      previewKey.current = "";
      setPreviewError("Could not render the preview.");
    } finally {
      if (!ac.signal.aborted) setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !settings) return;
    if (!content.trim()) {
      previewKey.current = "";
      setPreviewHtml("");
      setPreviewStats(null);
      setPreviewError("");
      return;
    }
    const t = setTimeout(() => void runPreview(content, settings), 400);
    return () => clearTimeout(t);
  }, [content, settings, loaded, runPreview]);

  // ── preview sizing (real page width, scaled into the pane) ──────────────────
  const measurePreviewDoc = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const doc = e.currentTarget.contentDocument;
    if (!doc) return;
    const height = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0, PAGE_HEIGHT_PX);
    setPreviewDocHeight(Math.min(height, 40 * PAGE_HEIGHT_PX));
  }, []);

  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => setPreviewScale(Math.min(1, (el.clientWidth || PAGE_WIDTH_PX) / PAGE_WIDTH_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, loaded, previewHtml]);

  // ── unsaved-work guards ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmDiscard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm(`You have unsaved changes in ${activeSource}. Discard them?`);
  }, [dirty, activeSource]);

  // ── actions ─────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source: activeSource }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save your CV.");
        return;
      }
      setBaseline(content);
      setExists(true);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Couldn't save your CV — the local server didn't respond.");
    } finally {
      setSaving(false);
    }
  }, [content, activeSource, saving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  /** Load a source into the editor and remember it as the active one in profile.yml. */
  async function loadSource(pathRel: string) {
    setSwitching(true);
    setError("");
    try {
      const res = await fetch(`/api/cv?source=${encodeURIComponent(pathRel)}`);
      if (!res.ok) {
        setError("Couldn't open that CV source.");
        return;
      }
      const d = await res.json();
      setActiveSource(d.source ?? pathRel);
      setContent(d.content ?? "");
      setBaseline(d.content ?? "");
      setExists(d.exists ?? false);

      const persisted = await fetch("/api/cv/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: pathRel }),
      });
      if (persisted.ok) {
        const j = await persisted.json();
        if (Array.isArray(j.sources)) setSources(j.sources);
      }
      setSettings((prev) => (prev ? { ...prev, source: pathRel } : prev));
    } catch {
      setError("Couldn't switch CV source.");
    } finally {
      setSwitching(false);
    }
  }

  function switchSource(pathRel: string) {
    if (pathRel === activeSource || switching) return;
    if (!confirmDiscard()) return;
    void loadSource(pathRel);
  }

  async function importFile(file: File) {
    if (!confirmDiscard()) return;
    setImporting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/cv/import", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      const list = await fetch("/api/cv/sources").then((r) => (r.ok ? r.json() : null));
      if (list?.sources) setSources(list.sources);
      await loadSource(data.path);
    } catch {
      setError("Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function patchStyle<K extends keyof CvStyle>(key: K, value: CvStyle[K]) {
    setSettings((prev) => (prev ? { ...prev, style: { ...prev.style, [key]: value } } : prev));
  }

  async function saveStyle() {
    if (!settings || savingStyle) return;
    setSavingStyle(true);
    setError("");
    try {
      const res = await fetch("/api/cv/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: settings.template, style: settings.style }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save the template settings.");
        return;
      }
      setStyleBaseline({ template: settings.template, style: settings.style });
    } catch {
      setError("Couldn't save the template settings.");
    } finally {
      setSavingStyle(false);
    }
  }

  const fontOptions = useMemo(() => {
    const current = settings?.style.font_stack ?? "";
    const known = FONT_PRESETS.some((f) => f.value === current);
    return known || !current ? FONT_PRESETS : [...FONT_PRESETS, { value: current, label: "Custom (from profile.yml)" }];
  }, [settings?.style.font_stack]);

  const showEditor = view !== "preview";
  const showPreview = view !== "edit";

  return (
    <PageShell width="wide">
      <DossierStack>
        <DossierPageHeader
          title="CV editor"
          description={
            <>
              Edit the markdown, pick a template, and preview the printed layout live. Editing{" "}
              <code className="rounded bg-[var(--md-sys-color-surface-container-high)] px-1.5 py-0.5 text-sm">{activeSource}</code>
              {!exists && loaded ? " — not created yet, saving will create it." : ""}
            </>
          }
          extra={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="default" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <MaterialSymbol name="progress_activity" size={18} className="animate-spin" /> : <MaterialSymbol name="upload" size={18} />}
                Import file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".md,.markdown,.txt"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importFile(f);
                  e.target.value = "";
                }}
              />
              <Button variant={dirty ? "primary" : "outline"} size="default" onClick={() => void save()} disabled={saving || !dirty} title="Save (⌘S)">
                {saving ? (
                  <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
                ) : saved ? (
                  <MaterialSymbol name="check" size={18} />
                ) : (
                  <MaterialSymbol name="save" size={18} />
                )}
                {saving ? "Saving" : saved ? "Saved" : dirty ? "Save" : "Saved"}
              </Button>
            </div>
          }
        />

        <p aria-live="polite" className="sr-only">
          {saving ? "Saving CV" : saved ? "CV saved" : dirty ? "Unsaved changes" : "All changes saved"}
        </p>

        {error && (
          <div className="md3-alert md3-alert--warning flex items-center gap-2" role="alert">
            <MaterialSymbol name="warning" size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setError("")}>
              <MaterialSymbol name="close" size={16} />
            </button>
          </div>
        )}

        {!loaded ? (
          <div className="flex justify-center py-16">
            <MaterialSymbol name="progress_activity" size={32} className="animate-spin text-[var(--md-sys-color-primary)]" />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">Source</span>
                {sources.map((s) => (
                  <Md3Chip
                    key={s.path}
                    active={activeSource === s.path}
                    disabled={!s.exists || switching}
                    title={s.exists ? s.path : `${s.path} — not created yet`}
                    onClick={() => switchSource(s.path)}
                  >
                    {s.label}
                  </Md3Chip>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                      readiness.scoreable
                        ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                        : "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
                    )}
                    title={readiness.hint ?? "Enough detail to score against job descriptions."}
                  >
                    <MaterialSymbol name={readiness.scoreable ? "check_circle" : "info"} size={13} />
                    {readiness.scoreable ? "Ready to match" : "Needs more detail"}
                  </span>
                  <span className="text-[11px] text-[var(--md-sys-color-outline)]">{readiness.words.toLocaleString()} words</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Md3Segmented<ViewMode>
                  value={view}
                  onChange={setView}
                  aria-label="Editor layout"
                  options={[
                    { value: "edit", label: "Edit" },
                    { value: "split", label: "Split" },
                    { value: "preview", label: "Preview" },
                  ]}
                />
                <a
                  href={`/api/cv/preview?source=${encodeURIComponent(activeSource)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "ml-auto inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)] hover:underline",
                    (dirty || !exists) && "pointer-events-none opacity-40",
                  )}
                  title={dirty ? "Save first — the full preview renders the file on disk" : "Open the full-page preview"}
                >
                  <MaterialSymbol name="open_in_new" size={14} />
                  Full preview
                </a>
              </div>

              <div className={cn("grid gap-4", view === "split" && "lg:grid-cols-2")}>
                {showEditor && (
                  // Raw field markup (not Md3Textarea) so the textarea can stretch to the
                  // pane height instead of growing the page as the CV gets longer.
                  <label className="md3-field md3-field--textarea h-[68vh] min-h-[420px] flex-col">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      spellCheck={false}
                      aria-label="CV markdown"
                      placeholder={"# Your Name\n\n**Email:** you@example.com\n\n## Professional Summary\n..."}
                      // .md3-field__input sets the `font` shorthand, which would win over a
                      // font-family utility — set the editor face inline instead.
                      style={{ font: "12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
                      className="md3-field__input min-h-0 w-full flex-1 resize-none"
                    />
                  </label>
                )}
                {showPreview && (
                  <Md3Card className="flex h-[68vh] min-h-[420px] flex-col overflow-hidden p-0" title="Printed layout preview">
                    {previewHtml && parseHint && (
                      <p className="mb-2 flex items-start gap-1.5 rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-tertiary-container)] px-2.5 py-2 text-[11px] text-[var(--md-sys-color-on-tertiary-container)]">
                        <MaterialSymbol name="info" size={14} className="mt-px shrink-0" />
                        {parseHint}
                      </p>
                    )}
                    <div ref={previewBoxRef} className="relative min-h-0 flex-1 overflow-auto bg-white">
                      {previewLoading && (
                        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/5 p-1.5">
                          <MaterialSymbol name="progress_activity" size={18} className="animate-spin text-[var(--md-sys-color-primary)]" />
                        </div>
                      )}
                      {previewError && (
                        <p className="p-4 text-sm text-[var(--md-sys-color-error)]">{previewError}</p>
                      )}
                      {!previewError && !previewHtml && !previewLoading && (
                        <p className="p-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                          Add CV content to see how it will print.
                        </p>
                      )}
                      {!previewError && previewHtml && (
                        // The document is laid out at real page width and scaled down to the
                        // pane, so the preview shows the printed proportions rather than a
                        // reflowed, narrow version of the page.
                        <div style={{ width: PAGE_WIDTH_PX * previewScale, height: previewDocHeight * previewScale }} className="relative">
                          <iframe
                            title="CV layout preview"
                            srcDoc={previewHtml}
                            onLoad={measurePreviewDoc}
                            style={{
                              width: PAGE_WIDTH_PX,
                              height: previewDocHeight,
                              transform: `scale(${previewScale})`,
                              transformOrigin: "top left",
                            }}
                            className="absolute left-0 top-0 border-0 bg-white"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      )}
                    </div>
                  </Md3Card>
                )}
              </div>
            </div>

            {settings && (
              <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                <Md3Card title="Template & style">
                  <p className="mb-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    Changes preview instantly. Save to write them to <code>config/profile.yml</code> so PDF runs use them too.
                  </p>

                  <span className="mb-2 block text-xs font-medium">Template</span>
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {settings.templates.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        aria-pressed={settings.template === t.name}
                        className="rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] px-2 py-2 text-left text-xs transition-colors data-[active=true]:border-[var(--md-sys-color-primary)] data-[active=true]:bg-[var(--md-sys-color-primary-container)]"
                        data-active={settings.template === t.name ? "true" : "false"}
                        onClick={() => setSettings({ ...settings, template: t.name })}
                      >
                        {t.displayName}
                      </button>
                    ))}
                  </div>

                  <label htmlFor="cv-accent" className="mb-1 block text-xs font-medium">
                    Accent colour
                  </label>
                  <input
                    id="cv-accent"
                    type="color"
                    value={settings.style.accent_color}
                    onChange={(e) => patchStyle("accent_color", e.target.value)}
                    className="mb-3 h-10 w-full cursor-pointer rounded border border-[var(--md-sys-color-outline-variant)]"
                  />

                  <label htmlFor="cv-heading" className="mb-1 block text-xs font-medium">
                    Heading colour
                  </label>
                  <input
                    id="cv-heading"
                    type="color"
                    value={settings.style.heading_color}
                    onChange={(e) => patchStyle("heading_color", e.target.value)}
                    className="mb-3 h-10 w-full cursor-pointer rounded border border-[var(--md-sys-color-outline-variant)]"
                  />

                  <span className="mb-1 block text-xs font-medium">Typeface</span>
                  <Md3Select
                    value={settings.style.font_stack}
                    onChange={(v) => patchStyle("font_stack", v)}
                    options={fontOptions}
                    aria-label="CV typeface"
                    className="mb-3 w-full"
                  />

                  <span className="mb-1 block text-xs font-medium">Density</span>
                  <Md3Segmented
                    className="mb-3"
                    value={settings.style.density}
                    onChange={(v) => patchStyle("density", v)}
                    aria-label="CV density"
                    options={[
                      { value: "compact", label: "Compact" },
                      { value: "standard", label: "Standard" },
                      { value: "spacious", label: "Spacious" },
                    ]}
                  />

                  <span className="mb-1 block text-xs font-medium">Page padding</span>
                  <Md3Segmented
                    value={settings.style.margin}
                    onChange={(v) => patchStyle("margin", v)}
                    aria-label="CV page padding"
                    options={MARGIN_PRESETS.map((m) => ({ value: m.value, label: m.label }))}
                  />

                  <Button
                    variant={styleDirty ? "primary" : "outline"}
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => void saveStyle()}
                    disabled={!styleDirty || savingStyle}
                  >
                    {savingStyle ? <MaterialSymbol name="progress_activity" size={16} className="animate-spin" /> : null}
                    {savingStyle ? "Saving" : styleDirty ? "Save style to profile" : "Style saved"}
                  </Button>
                  <button
                    type="button"
                    className="mt-2 w-full text-center text-[11px] text-[var(--md-sys-color-primary)] hover:underline disabled:opacity-40"
                    disabled={sameStyle(settings.style, DEFAULT_STYLE)}
                    onClick={() => setSettings({ ...settings, style: { ...DEFAULT_STYLE } })}
                  >
                    Reset style to defaults
                  </button>
                </Md3Card>
              </aside>
            )}
          </div>
        )}
      </DossierStack>
    </PageShell>
  );
}
