"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { Button } from "@/components/ui/button";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Select } from "@/components/ui/md3-select";
import { cvReadiness } from "@/lib/cv/quality";
import type { CvPreviewStats } from "@/lib/cv/preview";
import { AccentSwatches } from "@/components/cv/accent-swatches";
import { FullPreviewOverlay } from "@/components/cv/full-preview-overlay";
import { CvIngest } from "@/components/cv/cv-ingest";
import { assessFit, type CvStyleLike } from "@/lib/cv/fit";
import { DEFAULT_PAGE_FORMAT, pageBox, type CvPageFormat } from "@/lib/cv/page";
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
  pageFormat: CvPageFormat;
  style: CvStyle;
  templates: { name: string; displayName: string }[];
};

type CvSourceEntry = { path: string; label: string; exists: boolean; mtime: number };

type GeneratedCv = { file: string; label: string; mtime: number; pdf: boolean };

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

// Page geometry now comes from the selected format (lib/cv/page.ts) — the studio
// used to hard-code US Letter, which is exactly what S07 · redline 3 called out.

const MARGIN_PRESETS = [
  { value: "0", label: "Tight" },
  { value: "2px 0", label: "Default" },
  { value: "10px 0", label: "Roomy" },
];

function sameStyle(a: CvStyle, b: CvStyle): boolean {
  return (Object.keys(DEFAULT_STYLE) as (keyof CvStyle)[]).every((k) => a[k] === b[k]);
}

/** One-step undo target for "Fit to one page" (S08 · redline 4). */
type FitUndo = { style: CvStyle } | null;

export function CvEditor() {
  const [content, setContent] = useState("");
  const [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState<CvSettings | null>(null);
  const [styleBaseline, setStyleBaseline] = useState<{
    template: string;
    pageFormat: CvPageFormat;
    style: CvStyle;
  } | null>(null);
  const [savingStyle, setSavingStyle] = useState(false);

  const [sources, setSources] = useState<CvSourceEntry[]>([]);
  const [activeSource, setActiveSource] = useState("cv.md");
  const [switching, setSwitching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [forceEditor, setForceEditor] = useState(false);

  const [view, setView] = useState<ViewMode>("split");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewStats, setPreviewStats] = useState<CvPreviewStats | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [previewScale, setPreviewScale] = useState(1);
  const [previewDocHeight, setPreviewDocHeight] = useState(0);
  const [fullPreview, setFullPreview] = useState(false);
  // A finished, tailored render from output/ — shown instead of the live
  // preview so you can look at a real one-page CV, not the whole of cv.md.
  const [generated, setGenerated] = useState<GeneratedCv[]>([]);
  const [shownGenerated, setShownGenerated] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [fitUndo, setFitUndo] = useState<FitUndo>(null);
  const [baseMarkdown, setBaseMarkdown] = useState("");

  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewAbort = useRef<AbortController | null>(null);
  const previewKey = useRef("");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = content !== baseline;
  const styleDirty = !!(
    settings &&
    styleBaseline &&
    (settings.template !== styleBaseline.template ||
      settings.pageFormat !== styleBaseline.pageFormat ||
      !sameStyle(settings.style, styleBaseline.style))
  );
  const pageFormat = settings?.pageFormat ?? DEFAULT_PAGE_FORMAT;
  const box = pageBox(pageFormat);
  const fit = useMemo(
    () => assessFit(previewDocHeight || box.height, pageFormat, settings?.style ?? DEFAULT_STYLE),
    [previewDocHeight, pageFormat, settings?.style, box.height],
  );
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
          setStyleBaseline({ template: s.template, pageFormat: s.pageFormat, style: s.style });
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
    const key = JSON.stringify([md, s.template, s.pageFormat, s.style]);
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
        body: JSON.stringify({ content: md, template: s.template, pageFormat: s.pageFormat, style: s.style }),
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
  const measurePreviewDoc = useCallback(
    (e: React.SyntheticEvent<HTMLIFrameElement>) => {
      const doc = e.currentTarget.contentDocument;
      if (!doc) return;
      const height = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0, box.height);
      setPreviewDocHeight(Math.min(height, 40 * box.height));
    },
    [box.height],
  );

  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => {
      // Leave room for the pane's own padding so the page never touches the edge.
      const avail = Math.max(0, (el.clientWidth || box.width) - 32);
      const raw = avail / box.width;
      // Split keeps the page at 1:1 or smaller. Preview is the whole pane, so
      // the page scales UP to use it — otherwise a 794px document sits in a
      // 1200px pane and reads as a broken half-width layout.
      setPreviewScale(view === "preview" ? Math.min(2, Math.max(0.2, raw)) : Math.min(1, raw));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, loaded, previewHtml, box.width]);

  useEffect(() => {
    let alive = true;
    fetch("/api/cv/generated")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setGenerated(Array.isArray(d?.generated) ? d.generated : []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!shownGenerated) {
      setGeneratedHtml("");
      return;
    }
    let alive = true;
    fetch(`/api/cv/generated?file=${encodeURIComponent(shownGenerated)}`)
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => alive && setGeneratedHtml(html))
      .catch(() => alive && setGeneratedHtml(""));
    return () => {
      alive = false;
    };
  }, [shownGenerated]);

  // The base CV backs the tailoring diff (S08 · blueprint item 7). Only a
  // non-canonical source can be "tailored", so cv.md never diffs against itself.
  useEffect(() => {
    if (activeSource === "cv.md") {
      setBaseMarkdown("");
      return;
    }
    let alive = true;
    fetch("/api/cv?source=cv.md")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setBaseMarkdown(typeof d?.content === "string" ? d.content : ""))
      .catch(() => alive && setBaseMarkdown(""));
    return () => {
      alive = false;
    };
  }, [activeSource]);

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

  /** Apply the tightening the fit assessment proposed, remembering one undo. */
  function applyFit(next: CvStyleLike) {
    setSettings((prev) => {
      if (!prev) return prev;
      setFitUndo({ style: prev.style });
      return { ...prev, style: { ...prev.style, density: next.density, margin: next.margin } };
    });
  }

  async function saveStyle() {
    if (!settings || savingStyle) return;
    setSavingStyle(true);
    setError("");
    try {
      const res = await fetch("/api/cv/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: settings.template,
          pageFormat: settings.pageFormat,
          style: settings.style,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save the template settings.");
        return;
      }
      setStyleBaseline({ template: settings.template, pageFormat: settings.pageFormat, style: settings.style });
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
  // What the page pane actually shows: the live render of the buffer, or a
  // finished tailored render picked from output/.
  const viewingGenerated = !!shownGenerated && !!generatedHtml;
  const pageHtml = viewingGenerated ? generatedHtml : previewHtml;

  if (loaded && !exists && !content.trim() && !forceEditor) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="md-eyebrow">CV</p>
        <h1 className="md-display-small-emphasized mt-2">Add your CV</h1>
        <p className="mt-2.5 max-w-[620px] text-[15px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          Drop a PDF or a <code className="font-mono text-[13px]">.md</code> file. We save it locally as{" "}
          <code className="font-mono text-[13px]">cv.md</code> after you review it.
        </p>
        <div className="mt-6">
          <CvIngest
            afterSave="stay"
            onSaved={() => {
              fetch("/api/cv")
                .then((r) => r.json())
                .then((d: { content?: string; exists?: boolean }) => {
                  setContent(d.content ?? "");
                  setBaseline(d.content ?? "");
                  setExists(d.exists ?? false);
                })
                .catch(() => undefined);
            }}
          />
        </div>
        <button type="button" className="md3-btn-text mt-4 text-sm" onClick={() => setForceEditor(true)}>
          Write markdown instead
        </button>
      </div>
    );
  }

  return (
    <div className="cv-studio">
      {/* Blueprint S07 — three peers on one screen: markdown, the printed page,
          style. Everything that used to stack (page header, source row, view
          row, style card) collapses into one toolbar so the studio opens fully
          visible instead of asking for three scrolls. */}
      <header className="cv-studio__bar">
        <span className="md-title-medium shrink-0">CV</span>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
          {!exists && loaded && (
            <span className="text-[11px] text-[var(--md-sys-color-outline)]">not created yet — saving creates it</span>
          )}
        </div>

        {generated.length > 0 && (
          <Md3Select
            className="min-w-[190px]"
            aria-label="Which CV to show"
            value={shownGenerated}
            onChange={setShownGenerated}
            options={[
              { value: "", label: "Live preview (this buffer)" },
              ...generated.map((g) => ({
                value: g.file,
                label: `${g.label}${g.pdf ? " · PDF" : ""}`,
              })),
            ]}
          />
        )}

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

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
            fit.pages <= 1
              ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
              : "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
          )}
          title={`${fit.pages} page${fit.pages === 1 ? "" : "s"} at ${box.label}`}
        >
          <MaterialSymbol name={fit.pages <= 1 ? "check_circle" : "warning"} size={13} />
          {fit.message}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
            readiness.scoreable
              ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
              : "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
          )}
          title={readiness.hint ?? "Enough detail to score against job descriptions."}
        >
          <MaterialSymbol name={readiness.scoreable ? "check_circle" : "info"} size={13} />
          {readiness.scoreable ? "Ready to match" : "Needs detail"}
          <span className="opacity-70">· {readiness.words.toLocaleString()}w</span>
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setFullPreview(true)}
            disabled={!previewHtml}
            className="md3-btn-text min-h-9 text-xs disabled:opacity-40"
          >
            <MaterialSymbol name="fullscreen" size={16} />
            Full preview
          </button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? (
              <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
            ) : (
              <MaterialSymbol name="upload" size={16} />
            )}
            Import
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
          <Button variant={dirty ? "primary" : "outline"} size="sm" onClick={() => void save()} disabled={saving || !dirty} title="Save (⌘S)">
            {saving ? (
              <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
            ) : saved ? (
              <MaterialSymbol name="check" size={16} />
            ) : (
              <MaterialSymbol name="save" size={16} />
            )}
            {saving ? "Saving" : saved ? "Saved" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </header>

      <p aria-live="polite" className="sr-only">
        {saving ? "Saving CV" : saved ? "CV saved" : dirty ? "Unsaved changes" : "All changes saved"}
      </p>

      {error && (
        <div className="md3-alert md3-alert--warning mx-4 mt-3 flex items-center gap-2 py-2" role="alert">
          <MaterialSymbol name="warning" size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setError("")}>
            <MaterialSymbol name="close" size={16} />
          </button>
        </div>
      )}

      {!loaded ? (
        <div className="flex flex-1 items-center justify-center">
          <MaterialSymbol name="progress_activity" size={32} className="animate-spin text-[var(--md-sys-color-primary)]" />
        </div>
      ) : (
        <div className="cv-studio__panes" data-view={view}>
          {showEditor && (
            // Raw field markup (not Md3Textarea) so the textarea fills its pane
            // instead of growing the page as the CV gets longer.
            <label className="md3-field md3-field--textarea min-h-0 flex-col">
              <textarea
                data-lenis-prevent
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
            <section className="cv-studio__page">
              {viewingGenerated && (
                <p className="flex items-center gap-2 bg-[var(--md-sys-color-secondary-container)] px-3 py-2 text-[11px] text-[var(--md-sys-color-on-secondary-container)]">
                  <MaterialSymbol name="lock" size={14} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Finished render — {generated.find((g) => g.file === shownGenerated)?.label ?? shownGenerated}. Style
                    controls do not affect it.
                  </span>
                  <button type="button" className="shrink-0 underline" onClick={() => setShownGenerated("")}>
                    Back to live
                  </button>
                </p>
              )}
              {!viewingGenerated && previewHtml && parseHint && (
                <p className="flex items-start gap-1.5 bg-[var(--md-sys-color-tertiary-container)] px-3 py-2 text-[11px] text-[var(--md-sys-color-on-tertiary-container)]">
                  <MaterialSymbol name="info" size={14} className="mt-px shrink-0" />
                  {parseHint}
                </p>
              )}
              <div
                ref={previewBoxRef}
                data-lenis-prevent
                className="relative flex min-h-0 flex-1 justify-center overflow-auto bg-white p-4"
              >
                      {previewLoading && !viewingGenerated && (
                        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/5 p-1.5">
                          <MaterialSymbol name="progress_activity" size={18} className="animate-spin text-[var(--md-sys-color-primary)]" />
                        </div>
                      )}
                      {previewError && !viewingGenerated && (
                        <p className="p-4 text-sm text-[var(--md-sys-color-error)]">{previewError}</p>
                      )}
                      {!pageHtml && !previewLoading && (
                        <p className="p-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                          Add CV content to see how it will print.
                        </p>
                      )}
                      {pageHtml && (viewingGenerated || !previewError) && (
                        // The document is laid out at real page width and scaled down to the
                        // pane, so the preview shows the printed proportions rather than a
                        // reflowed, narrow version of the page.
                        <div
                          style={{
                            width: box.width * previewScale,
                            height: (previewDocHeight || box.height) * previewScale,
                          }}
                          className="relative shrink-0 self-start shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
                        >
                          <iframe
                            title="CV layout preview"
                            srcDoc={pageHtml}
                            onLoad={measurePreviewDoc}
                            style={{
                              width: box.width,
                              height: previewDocHeight || box.height,
                              transform: `scale(${previewScale})`,
                              transformOrigin: "top left",
                            }}
                            className="absolute left-0 top-0 border-0 bg-white"
                            sandbox="allow-same-origin"
                          />
                          {/* The page cut, drawn where it actually lands (S08 · 3). */}
                          {Array.from({ length: fit.pages - 1 }, (_, i) => (
                            <div
                              key={i}
                              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[var(--md-sys-color-primary)]"
                              style={{ top: (i + 1) * box.height * previewScale }}
                            />
                          ))}
                        </div>
                      )}
              </div>
            </section>
          )}

          {settings && (
            <aside className="cv-studio__rail" data-lenis-prevent>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    Changes preview instantly. Save to write them to <code>config/profile.yml</code> so PDF runs use them too.
                  </p>

                  {/* Template selection lives in profile.yml / the CLI — the
                      studio rail stays a pure style surface (colour, type,
                      density, padding, page box). */}
                  <span className="mb-1 block text-xs font-medium">Page size</span>
                  <Md3Segmented<CvPageFormat>
                    className="mb-4"
                    value={settings.pageFormat}
                    onChange={(v) => setSettings({ ...settings, pageFormat: v })}
                    aria-label="Page size"
                    options={[
                      { value: "a4", label: "A4" },
                      { value: "letter", label: "Letter" },
                    ]}
                  />

                  <div className="mb-4">
                    <AccentSwatches
                      accent={settings.style.accent_color}
                      onChange={(next) =>
                        setSettings({ ...settings, style: { ...settings.style, ...next } })
                      }
                    />
                  </div>

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

                {/* S07 · gap 4 — the fit warning states the spill and offers the
                    exact fix, undoable in one step. Only shown when there is
                    something to fix; a CV that fits says so in the toolbar. */}
                {(fitUndo || fit.proposal) && (
                  <div className="rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container-high)] p-3">
                  <p className="mb-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {fit.message} at {box.label}.
                  </p>
                  {fitUndo ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSettings({ ...settings, style: fitUndo.style });
                        setFitUndo(null);
                      }}
                    >
                      <MaterialSymbol name="undo" size={16} />
                      Undo fit
                    </Button>
                  ) : (
                    fit.proposal && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => applyFit(fit.proposal!)}
                      >
                        Fit to one page
                      </Button>
                    )
                  )}
                  </div>
                )}
            </aside>
          )}
        </div>
      )}

      {settings && (
        <FullPreviewOverlay
          open={fullPreview}
          onClose={() => setFullPreview(false)}
          html={previewHtml}
          markdown={content}
          templateLabel={
            settings.templates.find((t) => t.name === settings.template)?.displayName ?? settings.template
          }
          pageFormat={settings.pageFormat}
          onPageFormat={(f) => setSettings({ ...settings, pageFormat: f })}
          style={settings.style as unknown as Record<string, string> & CvStyleLike}
          onApplyFit={applyFit}
          baseMarkdown={baseMarkdown}
          source={activeSource}
        />
      )}
    </div>
  );
}
