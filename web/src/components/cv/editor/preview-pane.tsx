"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import type { PageBox } from "@/lib/cv/page";
import type { CvPreview } from "./use-cv-preview";

/**
 * The printed page: laid out at real page width and scaled into the pane, with a
 * dashed line where each page break lands.
 */
export function PreviewPane({ preview, hint, box, pages, fill, onDocHeight }: {
  preview: CvPreview;
  hint: string;
  box: PageBox;
  pages: number;
  /** Preview-only layout may scale the page up to use the whole pane. */
  fill: boolean;
  onDocHeight: (height: number) => void;
}) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [docHeight, setDocHeight] = useState(0);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => {
      const raw = Math.max(0, (el.clientWidth || box.width) - 32) / box.width;
      setScale(fill ? Math.min(2, Math.max(0.2, raw)) : Math.min(1, raw));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill, preview.html, box.width]);

  const measure = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const doc = e.currentTarget.contentDocument;
    if (!doc) return;
    const height = Math.min(Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0, box.height), 40 * box.height);
    setDocHeight(height);
    onDocHeight(height);
  }, [box.height, onDocHeight]);

  const height = docHeight || box.height;
  return (
    <section className="cv-studio__page">
      {preview.html && hint && (
        <p className="flex items-start gap-1.5 bg-[var(--md-sys-color-tertiary-container)] px-3 py-2 text-[11px] text-[var(--md-sys-color-on-tertiary-container)]">
          <MaterialSymbol name="info" size={14} className="mt-px shrink-0" />
          {hint}
        </p>
      )}
      <div ref={paneRef} className="relative flex min-h-0 flex-1 justify-center overflow-auto bg-white p-4">
        {preview.loading && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-black/5 p-1.5">
            <MaterialSymbol name="progress_activity" size={18} className="animate-spin text-[var(--md-sys-color-primary)]" />
          </div>
        )}
        {preview.error && <p className="p-4 text-sm text-[var(--md-sys-color-error)]">{preview.error}</p>}
        {!preview.html && !preview.loading && <p className="p-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">Add CV content to see how it will print.</p>}
        {preview.html && !preview.error && (
          <div style={{ width: box.width * scale, height: height * scale }} className="relative shrink-0 self-start shadow-[0_2px_12px_rgb(0_0_0/0.12)]">
            <iframe
              title="CV layout preview"
              srcDoc={preview.html}
              onLoad={measure}
              style={{ width: box.width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
              className="absolute left-0 top-0 border-0 bg-white"
              sandbox="allow-same-origin"
            />
            {Array.from({ length: pages - 1 }, (_, i) => (
              <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[var(--md-sys-color-primary)]" style={{ top: (i + 1) * box.height * scale }} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
