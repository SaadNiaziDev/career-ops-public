"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { runAtsChecks } from "@/lib/cv/ats";
import { assessFit, describeChange, type CvStyleLike } from "@/lib/cv/fit";
import { pageBox, pageCount, type CvPageFormat } from "@/lib/cv/page";
import { cn } from "@/lib/cn";

// Blueprint S08 · CV full preview. It is an OVERLAY over the studio that renders
// the CURRENT BUFFER — page thumbnails, the real page-break line, what spills
// and the exact fix, an advisory ATS read, and PDF from the same live render.
// The shipped code opened a saved file in a new tab and disabled itself while
// there were unsaved edits; this replaces that entirely.

const THUMB_WIDTH = 150;

type Style = Record<string, string> & CvStyleLike;

type DiffLine = { text: string; kind: "added" | "removed" | "same" };

/** Line diff against the base CV — enough to mark what a tailoring changed. */
function diffLines(base: string, current: string): DiffLine[] {
  const baseSet = new Map<string, number>();
  for (const line of base.split("\n")) {
    const k = line.trim();
    if (k) baseSet.set(k, (baseSet.get(k) ?? 0) + 1);
  }
  const out: DiffLine[] = [];
  for (const line of current.split("\n")) {
    const k = line.trim();
    if (!k) continue;
    const left = baseSet.get(k) ?? 0;
    if (left > 0) {
      baseSet.set(k, left - 1);
      out.push({ text: line, kind: "same" });
    } else {
      out.push({ text: line, kind: "added" });
    }
  }
  for (const [line, count] of baseSet) {
    for (let i = 0; i < count; i++) out.push({ text: line, kind: "removed" });
  }
  return out;
}

export function FullPreviewOverlay({
  open,
  onClose,
  html,
  markdown,
  templateLabel,
  pageFormat,
  onPageFormat,
  style,
  onApplyFit,
  baseMarkdown,
  source,
}: {
  open: boolean;
  onClose: () => void;
  html: string;
  markdown: string;
  templateLabel: string;
  pageFormat: CvPageFormat;
  onPageFormat: (f: CvPageFormat) => void;
  style: Style;
  /** Applies the proposed tightening — the studio owns undo of one step. */
  onApplyFit: (next: CvStyleLike) => void;
  /** cv.md, for the tailoring diff. Empty when the active source IS cv.md. */
  baseMarkdown: string;
  source: string;
}) {
  const [docHeight, setDocHeight] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const box = pageBox(pageFormat);
  const pages = docHeight ? pageCount(docHeight, pageFormat) : 1;
  const fit = useMemo(() => assessFit(docHeight || box.height, pageFormat, style), [docHeight, pageFormat, style, box.height]);
  const ats = useMemo(() => (html ? runAtsChecks(markdown, html) : []), [html, markdown]);
  const atsOk = ats.every((c) => c.ok);
  const diff = useMemo(
    () => (baseMarkdown ? diffLines(baseMarkdown, markdown) : []),
    [baseMarkdown, markdown],
  );
  const addedCount = diff.filter((d) => d.kind === "added").length;

  const measure = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const doc = e.currentTarget.contentDocument;
    if (!doc) return;
    const h = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0);
    setDocHeight(h || 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function generatePdf() {
    setGenerating(true);
    setPdfError("");
    try {
      const res = await fetch("/api/cv/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: markdown, pageFormat, style, source }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setPdfError(data.error || "PDF generation failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError("Could not reach the local server.");
    } finally {
      setGenerating(false);
    }
  }

  if (!open) return null;

  const thumbScale = THUMB_WIDTH / box.width;

  return (
    <div className="cv-overlay" role="dialog" aria-modal="true" aria-label="CV full preview">
      <header className="cv-overlay__bar">
        <button type="button" className="md3-btn-text" onClick={onClose} aria-label="Close full preview">
          <MaterialSymbol name="close" size={20} />
          Close
        </button>
        <span className="text-sm font-medium">{templateLabel}</span>
        <Md3Segmented<CvPageFormat>
          value={pageFormat}
          onChange={onPageFormat}
          aria-label="Page size"
          options={[
            { value: "a4", label: "A4" },
            { value: "letter", label: "Letter" },
          ]}
        />
        <span
          className={cn(
            "config-status-chip min-h-8 text-xs",
            fit.pages <= 1 ? "config-status-chip--ready" : "config-status-chip--pending",
          )}
        >
          <MaterialSymbol name={fit.pages <= 1 ? "check" : "warning"} size={14} />
          {fit.message}
        </span>
        <span className="text-xs text-[var(--md-sys-color-outline)]">
          {pages} page{pages === 1 ? "" : "s"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {baseMarkdown && (
            <button
              type="button"
              className={cn("md3-btn-outlined min-h-10", showDiff && "border-[var(--md-sys-color-primary)]")}
              aria-pressed={showDiff}
              onClick={() => setShowDiff((v) => !v)}
            >
              <MaterialSymbol name="difference" size={18} />
              Tailoring diff
              {addedCount > 0 && <span className="md3-tab-badge ml-1">{addedCount}</span>}
            </button>
          )}
          <button type="button" className="md3-btn-outlined min-h-10" onClick={() => window.print()}>
            <MaterialSymbol name="print" size={18} />
            Print
          </button>
          <button type="button" className="md3-btn-filled min-h-10" onClick={() => void generatePdf()} disabled={generating}>
            {generating ? (
              <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
            ) : (
              <MaterialSymbol name="picture_as_pdf" size={18} />
            )}
            {generating ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </header>

      {generating && <div className="job-indeterminate h-1 w-full bg-[var(--md-sys-color-surface-container-high)]" />}
      {pdfError && (
        <p className="md3-alert md3-alert--error m-4" role="alert">
          <MaterialSymbol name="error" size={20} className="shrink-0" />
          {pdfError}
        </p>
      )}

      <div className="cv-overlay__body">
        {/* Page thumbnails — 150px, click to jump, selected outlined in primary. */}
        <nav className="cv-overlay__thumbs" aria-label="Pages" data-lenis-prevent>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-current={activePage === i}
              onClick={() => {
                setActivePage(i);
                pageRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "cv-overlay__thumb",
                activePage === i && "cv-overlay__thumb--active",
              )}
              style={{ width: THUMB_WIDTH, height: box.height * thumbScale }}
            >
              {html && (
                <iframe
                  title={`Page ${i + 1} thumbnail`}
                  srcDoc={html}
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{
                    width: box.width,
                    height: docHeight || box.height,
                    transform: `scale(${thumbScale}) translateY(${-i * box.height}px)`,
                    transformOrigin: "top left",
                  }}
                  className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              )}
              <span className="cv-overlay__thumb-num">{i + 1}</span>
            </button>
          ))}
        </nav>

        <div ref={scrollRef} className="cv-overlay__stage" data-lenis-prevent>
          {showDiff ? (
            <div className="cv-diff">
              <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {addedCount} line{addedCount === 1 ? "" : "s"} differ from <code className="font-mono">cv.md</code> —
                this is what tailoring for this job changed.
              </p>
              {diff
                .filter((d) => d.kind !== "same")
                .map((d, i) => (
                  <p key={`${d.kind}-${i}`} className={cn("cv-diff__line", `cv-diff__line--${d.kind}`)}>
                    <span aria-hidden="true">{d.kind === "added" ? "+" : "−"}</span> {d.text}
                  </p>
                ))}
              {addedCount === 0 && diff.length === 0 && (
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  Identical to the base CV — nothing was tailored.
                </p>
              )}
            </div>
          ) : (
            <div className="cv-overlay__doc" style={{ width: box.width }}>
              {html ? (
                <>
                  <iframe
                    title="CV full preview"
                    srcDoc={html}
                    onLoad={measure}
                    style={{ width: box.width, height: docHeight || box.height }}
                    className="block border-0 bg-white"
                    sandbox="allow-same-origin"
                  />
                  {/* The break line is drawn where the cut actually lands. */}
                  {Array.from({ length: pages - 1 }, (_, i) => (
                    <div
                      key={i}
                      ref={(el) => {
                        pageRefs.current[i + 1] = el;
                      }}
                      className="cv-overlay__break"
                      style={{ top: (i + 1) * box.height }}
                    >
                      <span>page {i + 2}</span>
                    </div>
                  ))}
                  <div
                    ref={(el) => {
                      pageRefs.current[0] = el;
                    }}
                    className="absolute left-0 top-0"
                  />
                </>
              ) : (
                <p className="p-6 text-sm text-[var(--md-sys-color-on-surface-variant)]">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>

        <aside className="cv-overlay__rail" data-lenis-prevent>
          {/* Fit panel — collapses to one line when the CV already fits. */}
          {fit.pages <= 1 ? (
            <p className="cv-fit cv-fit--ok">
              <MaterialSymbol name="check_circle" size={16} />
              Fits one {box.label} page
            </p>
          ) : (
            <div className="cv-fit">
              <p className="mb-1 text-sm font-medium">{fit.message}</p>
              {fit.proposal ? (
                <>
                  <ul className="mb-2 list-disc pl-4 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {describeChange(style, fit.proposal).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="md3-btn-filled min-h-10 w-full"
                    onClick={() => onApplyFit(fit.proposal!)}
                  >
                    Fit to one page
                  </button>
                  <p className="mt-1.5 text-[11px] text-[var(--md-sys-color-outline)]">
                    Previewed live · one Undo in the studio reverts it.
                  </p>
                </>
              ) : (
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  Density and padding are already at their tightest — the rest is an editing decision.
                </p>
              )}
            </div>
          )}

          <div className="cv-ats">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">ATS check</span>
              <span
                className={cn(
                  "config-status-chip min-h-8 text-xs",
                  atsOk ? "config-status-chip--ready" : "config-status-chip--pending",
                )}
              >
                {atsOk ? "clean" : `${ats.filter((c) => !c.ok).length} to look at`}
              </span>
            </div>
            <ul className="space-y-2">
              {ats.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <MaterialSymbol
                    name={c.ok ? "check_circle" : "info"}
                    size={16}
                    className={cn(
                      "mt-0.5 shrink-0",
                      c.ok ? "text-[var(--md-sys-color-tertiary)]" : "text-[var(--md-sys-color-secondary)]",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{c.label}</span>
                    <span className="block text-[11px] text-[var(--md-sys-color-on-surface-variant)]">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-[var(--md-sys-color-outline)]">
              Advisory only — nothing here blocks a PDF.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
