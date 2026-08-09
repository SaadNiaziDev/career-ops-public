"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { pageBox, type CvPageFormat } from "@/lib/cv/page";
import { cn } from "@/lib/cn";

// Blueprint S07 · gap 5 — templates are miniature renders, 2×2, selected
// outlined in primary. The miniature is the SAME renderer at 12% scale, so what
// you pick is what prints; text buttons could never show that.

const SCALE = 0.12;

type Template = { name: string; displayName: string };

export function TemplateGallery({
  templates,
  selected,
  onSelect,
  content,
  pageFormat,
  style,
}: {
  templates: Template[];
  selected: string;
  onSelect: (name: string) => void;
  content: string;
  pageFormat: CvPageFormat;
  style: Record<string, string>;
}) {
  const [renders, setRenders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const requested = useRef("");
  const box = pageBox(pageFormat);

  // Each miniature costs a renderer spawn — four of them. They are keyed on the
  // full input and debounced well behind the main preview, so typing refreshes
  // the big preview at 400ms and the gallery only once the user has stopped.
  useEffect(() => {
    if (!content.trim() || templates.length === 0) return;
    const key = JSON.stringify([content, style, pageFormat, templates.map((t) => t.name)]);
    if (key === requested.current) return;

    let alive = true;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      requested.current = key;
      setLoading(true);
      Promise.all(
        templates.map(async (t) => {
          try {
            const res = await fetch("/api/cv/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content, template: t.name, pageFormat, style }),
              signal: ac.signal,
            });
            if (!res.ok) return [t.name, ""] as const;
            const data = (await res.json()) as { html?: string };
            return [t.name, data.html ?? ""] as const;
          } catch {
            return [t.name, ""] as const;
          }
        }),
      )
        .then((pairs) => {
          if (!alive) return;
          setRenders(Object.fromEntries(pairs));
        })
        .finally(() => alive && setLoading(false));
    }, 1500);

    return () => {
      alive = false;
      clearTimeout(timer);
      ac.abort();
    };
  }, [content, templates, pageFormat, style]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium">Template</span>
        {loading && (
          <MaterialSymbol
            name="progress_activity"
            size={14}
            className="animate-spin text-[var(--md-sys-color-primary)]"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t) => {
          const active = t.name === selected;
          const html = renders[t.name];
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(t.name)}
              className={cn(
                "group overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] border-2 text-left transition-colors",
                active
                  ? "border-[var(--md-sys-color-primary)]"
                  : "border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline)]",
              )}
            >
              <div
                className="relative overflow-hidden bg-white"
                style={{ width: "100%", height: box.height * SCALE }}
              >
                {html ? (
                  <iframe
                    title={`${t.displayName} miniature`}
                    srcDoc={html}
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{
                      width: box.width,
                      height: box.height,
                      transform: `scale(${SCALE})`,
                      transformOrigin: "top left",
                    }}
                    className="pointer-events-none absolute left-0 top-0 border-0"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-[color:#999]">
                    {loading ? "rendering…" : "no preview"}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "flex items-center justify-between gap-1 px-2 py-1.5 text-[11px]",
                  active
                    ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)]",
                )}
              >
                {t.displayName}
                {active && <MaterialSymbol name="check" size={14} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
