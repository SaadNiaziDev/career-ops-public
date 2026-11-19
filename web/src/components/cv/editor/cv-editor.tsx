"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { Button } from "@/components/ui/button";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { CvIngest } from "@/components/cv/cv-ingest";
import { FullPreviewOverlay } from "@/components/cv/full-preview-overlay";
import { TailoredCvLibrary } from "@/components/cv/tailored-cv-library";
import { assessFit, type CvStyleLike } from "@/lib/cv/fit";
import { DEFAULT_PAGE_FORMAT, pageBox } from "@/lib/cv/page";
import { cvReadiness } from "@/lib/cv/quality";
import { cn } from "@/lib/cn";
import { DEFAULT_STYLE, sameStyle, type CvSettings, type CvSourceEntry, type CvStyle, type ViewMode } from "./cv-style";
import { PreviewPane } from "./preview-pane";
import { StyleRail } from "./style-rail";
import { parseHint, useCvPreview } from "./use-cv-preview";

type StyleBaseline = Pick<CvSettings, "template" | "pageFormat" | "style">;

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** Master CV (cv.md) and other CV sources: markdown on the left, the printed page on the right. */
export function CvEditor() {
  const [section, setSection] = useState<"master" | "tailored">("master");
  const [view, setView] = useState<ViewMode>("split");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const [baseline, setBaseline] = useState("");
  const [exists, setExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [forceEditor, setForceEditor] = useState(false);

  const [sources, setSources] = useState<CvSourceEntry[]>([]);
  const [activeSource, setActiveSource] = useState("cv.md");
  const [switching, setSwitching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [baseMarkdown, setBaseMarkdown] = useState("");

  const [settings, setSettings] = useState<CvSettings | null>(null);
  const [styleBaseline, setStyleBaseline] = useState<StyleBaseline | null>(null);
  const [savingStyle, setSavingStyle] = useState(false);
  const [fitUndo, setFitUndo] = useState<CvStyle | null>(null);
  const [docHeight, setDocHeight] = useState(0);
  const [fullPreview, setFullPreview] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMaster = activeSource === "cv.md";
  const dirty = content !== baseline;
  const styleDirty = !!(settings && styleBaseline && (
    settings.template !== styleBaseline.template || settings.pageFormat !== styleBaseline.pageFormat || !sameStyle(settings.style, styleBaseline.style)
  ));
  const box = pageBox(settings?.pageFormat ?? DEFAULT_PAGE_FORMAT);
  const fit = useMemo(
    () => assessFit(docHeight || box.height, settings?.pageFormat ?? DEFAULT_PAGE_FORMAT, settings?.style ?? DEFAULT_STYLE),
    [docHeight, box.height, settings?.pageFormat, settings?.style],
  );
  const readiness = useMemo(() => cvReadiness(content), [content]);
  const preview = useCvPreview(content, settings, loaded);

  // ── loading ────────────────────────────────────────────────────────────────
  const applyCv = (d: { content?: string; exists?: boolean; source?: string }, fallbackSource = "cv.md") => {
    setContent(d.content ?? "");
    setBaseline(d.content ?? "");
    setExists(d.exists ?? false);
    setActiveSource(d.source ?? fallbackSource);
  };

  useEffect(() => {
    if (new URLSearchParams(location.search).get("report")) setSection("tailored");
    let alive = true;
    Promise.all([fetch("/api/cv?source=cv.md"), fetch("/api/cv/settings"), fetch("/api/cv/sources")])
      .then(async ([cvRes, settingsRes, sourcesRes]) => {
        if (!alive) return;
        if (cvRes.ok) applyCv(await cvRes.json());
        else setError("Couldn't load your CV file.");
        if (settingsRes.ok) {
          const s = (await settingsRes.json()) as CvSettings;
          setSettings(s);
          setStyleBaseline({ template: s.template, pageFormat: s.pageFormat, style: s.style });
        }
        if (sourcesRes.ok) setSources((await sourcesRes.json()).sources ?? []);
      })
      .catch(() => alive && setError("Couldn't reach the local server."))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  // A tailored source is compared against the master CV in the full preview.
  useEffect(() => {
    if (isMaster) { setBaseMarkdown(""); return; }
    let alive = true;
    fetch("/api/cv?source=cv.md")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setBaseMarkdown(typeof d?.content === "string" ? d.content : ""))
      .catch(() => alive && setBaseMarkdown(""));
    return () => { alive = false; };
  }, [isMaster]);

  // ── unsaved-work guards ────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmDiscard = useCallback(
    () => !dirty || window.confirm(`You have unsaved changes in ${activeSource}. Discard them?`),
    [dirty, activeSource],
  );

  // ── actions ────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const { ok, data } = await postJson("/api/cv", { content, source: activeSource });
      if (!ok) { setError(String(data.error || "Couldn't save your CV.")); return; }
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

  async function loadSource(pathRel: string) {
    setSwitching(true);
    setError("");
    try {
      const res = await fetch(`/api/cv?source=${encodeURIComponent(pathRel)}`);
      if (!res.ok) { setError("Couldn't open that CV source."); return; }
      applyCv(await res.json(), pathRel);
      setSettings((prev) => (prev ? { ...prev, source: pathRel } : prev));
    } catch {
      setError("Couldn't switch CV source.");
    } finally {
      setSwitching(false);
    }
  }

  function switchSource(pathRel: string) {
    if (pathRel !== activeSource && !switching && confirmDiscard()) void loadSource(pathRel);
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
      if (!res.ok) { setError(data.error || "Import failed."); return; }
      const list = await fetch("/api/cv/sources").then((r) => (r.ok ? r.json() : null));
      if (list?.sources) setSources(list.sources);
      await loadSource(data.path);
    } catch {
      setError("Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function saveStyle() {
    if (!settings || savingStyle) return;
    setSavingStyle(true);
    setError("");
    try {
      const { ok, data } = await postJson("/api/cv/settings", { template: settings.template, pageFormat: settings.pageFormat, style: settings.style });
      if (!ok) { setError(String(data.error || "Couldn't save the template settings.")); return; }
      setStyleBaseline({ template: settings.template, pageFormat: settings.pageFormat, style: settings.style });
    } catch {
      setError("Couldn't save the template settings.");
    } finally {
      setSavingStyle(false);
    }
  }

  /** Apply the tightening the fit check proposed, remembering one undo step. */
  function applyFit(next: CvStyleLike) {
    if (!settings) return;
    setFitUndo(settings.style);
    setSettings({ ...settings, style: { ...settings.style, density: next.density, margin: next.margin } });
  }

  // ── first run: no CV yet ───────────────────────────────────────────────────
  if (loaded && !exists && !content.trim() && !forceEditor) {
    return (
      <div className="search-page">
        <header className="search-head">
          <div>
            <h1 className="md-headline-medium">Add your CV</h1>
            <p className="search-sub">Drop a PDF or a .md file. It is saved locally as cv.md after you review it.</p>
          </div>
        </header>
        <CvIngest afterSave="stay" onSaved={() => void fetch("/api/cv?source=cv.md").then((r) => r.json()).then((d) => applyCv(d)).catch(() => undefined)} />
        <button type="button" className="md3-btn-text w-fit text-sm" onClick={() => setForceEditor(true)}>Write markdown instead</button>
      </div>
    );
  }

  const chip = "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium";
  const goodChip = "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]";
  const infoChip = "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]";

  return (
    <div className="cv-studio">
      <h1 className="sr-only">Master CV and tailored CVs</h1>
      <header className="cv-studio__bar">
        <Md3Segmented value={section} onChange={setSection} aria-label="CV workspace" options={[{ value: "master", label: "Master CV" }, { value: "tailored", label: "Tailored CVs" }]} />
        {section === "master" && (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {sources.map((s) => (
                <Md3Chip key={s.path} active={activeSource === s.path} disabled={!s.exists || switching} title={s.exists ? s.path : `${s.path} — not created yet`} onClick={() => switchSource(s.path)}>
                  {s.path === "cv.md" ? "Master · cv.md" : `Source · ${s.label}`}
                </Md3Chip>
              ))}
              {!exists && loaded && <span className="text-[11px] text-[var(--md-sys-color-outline)]">not created yet — saving creates it</span>}
            </div>
            <Md3Segmented<ViewMode> value={view} onChange={setView} aria-label="Editor layout" options={[{ value: "edit", label: "Edit" }, { value: "split", label: "Split" }, { value: "preview", label: "Preview" }]} />
            {!isMaster && (
              <span className={cn(chip, fit.pages <= 1 ? goodChip : infoChip)} title={`${fit.pages} page${fit.pages === 1 ? "" : "s"} at ${box.label}`}>
                <MaterialSymbol name={fit.pages <= 1 ? "check_circle" : "warning"} size={13} />
                {fit.message}
              </span>
            )}
            <span className={cn(chip, readiness.scoreable ? infoChip : goodChip)} title={readiness.hint ?? "Enough detail to score against job descriptions."}>
              <MaterialSymbol name={readiness.scoreable ? "check_circle" : "info"} size={13} />
              {readiness.scoreable ? "Ready to match" : "Needs detail"}
              <span className="opacity-70">· {readiness.words.toLocaleString()}w</span>
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setFullPreview(true)} disabled={!preview.html || isMaster} className="md3-btn-text min-h-9 text-xs disabled:opacity-40">
                <MaterialSymbol name="fullscreen" size={16} />
                Full preview
              </button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                <MaterialSymbol name={importing ? "progress_activity" : "upload"} size={16} className={importing ? "animate-spin" : undefined} />
                Import
              </Button>
              <input ref={fileRef} type="file" accept=".md,.markdown,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
              <Button variant={dirty ? "primary" : "outline"} size="sm" onClick={() => void save()} disabled={saving || !dirty} title="Save (⌘S)">
                <MaterialSymbol name={saving ? "progress_activity" : saved ? "check" : "save"} size={16} className={saving ? "animate-spin" : undefined} />
                {saving ? "Saving" : dirty ? `Save ${activeSource}` : `Saved ${activeSource}`}
              </Button>
            </div>
          </>
        )}
      </header>

      <p aria-live="polite" className="sr-only">{saving ? "Saving CV" : saved ? `${activeSource} saved` : dirty ? "Unsaved changes" : "All changes saved"}</p>

      {section === "master" && (
        <p className="px-4 py-2 text-sm">
          Keep all your evidence here; length does not matter. Experience: {readiness.hasExperience ? "present" : "add roles and achievements"} · Skills: {readiness.hasSkills ? "present" : "add a skills section"}.
        </p>
      )}
      {error && (
        <div className="md3-alert md3-alert--warning mx-4 mt-3 flex items-center gap-2 py-2" role="alert">
          <MaterialSymbol name="warning" size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setError("")}><MaterialSymbol name="close" size={16} /></button>
        </div>
      )}

      {section === "tailored" ? (
        <TailoredCvLibrary />
      ) : !loaded ? (
        <div className="flex flex-1 items-center justify-center"><MaterialSymbol name="progress_activity" size={32} className="animate-spin text-[var(--md-sys-color-primary)]" /></div>
      ) : (
        <div className="cv-studio__panes" data-view={view} data-master={isMaster}>
          {view !== "preview" && (
            <label className="md3-field md3-field--textarea min-h-0 flex-col">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                aria-label="CV markdown"
                placeholder={"# Your Name\n\n**Email:** you@example.com\n\n## Professional Summary\n..."}
                style={{ font: "12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
                className="md3-field__input min-h-0 w-full flex-1 resize-none"
              />
            </label>
          )}
          {view !== "edit" && <PreviewPane preview={preview} hint={parseHint(preview.stats)} box={box} pages={fit.pages} fill={view === "preview"} onDocHeight={setDocHeight} />}
          {settings && !isMaster && (
            <StyleRail
              settings={settings}
              onChange={setSettings}
              dirty={styleDirty}
              saving={savingStyle}
              onSave={() => void saveStyle()}
              fit={fit}
              box={box}
              canUndoFit={!!fitUndo}
              onFit={() => fit.proposal && applyFit(fit.proposal)}
              onUndoFit={() => { if (fitUndo) setSettings({ ...settings, style: fitUndo }); setFitUndo(null); }}
            />
          )}
        </div>
      )}

      {settings && (
        <FullPreviewOverlay
          open={fullPreview}
          onClose={() => setFullPreview(false)}
          html={preview.html}
          markdown={content}
          templateLabel={settings.templates.find((t) => t.name === settings.template)?.displayName ?? settings.template}
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
