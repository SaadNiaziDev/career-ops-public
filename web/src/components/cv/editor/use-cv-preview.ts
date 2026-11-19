"use client";

import { useEffect, useRef, useState } from "react";
import type { CvPreviewStats } from "@/lib/cv/preview";
import type { CvSettings } from "./cv-style";

export type CvPreview = { html: string; stats: CvPreviewStats | null; loading: boolean; error: string };

/** Renders the CV markdown to print HTML on the server, debounced, cancelling stale requests. */
export function useCvPreview(markdown: string, settings: CvSettings | null, enabled: boolean): CvPreview {
  const [preview, setPreview] = useState<CvPreview>({ html: "", stats: null, loading: false, error: "" });
  const lastKey = useRef("");
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => () => inflight.current?.abort(), []);

  useEffect(() => {
    if (!enabled || !settings) return;
    if (!markdown.trim()) {
      lastKey.current = "";
      setPreview({ html: "", stats: null, loading: false, error: "" });
      return;
    }
    const key = JSON.stringify([markdown, settings.template, settings.pageFormat, settings.style]);
    if (key === lastKey.current) return;

    const timer = setTimeout(async () => {
      lastKey.current = key;
      inflight.current?.abort();
      const ac = new AbortController();
      inflight.current = ac;
      setPreview((p) => ({ ...p, loading: true }));
      try {
        const res = await fetch("/api/cv/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: markdown, template: settings.template, pageFormat: settings.pageFormat, style: settings.style }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (!res.ok) {
          lastKey.current = "";
          setPreview({ html: "", stats: null, loading: false, error: data.error || "Preview failed" });
          return;
        }
        setPreview({ html: data.html ?? "", stats: data.stats ?? null, loading: false, error: "" });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        lastKey.current = "";
        setPreview((p) => ({ ...p, loading: false, error: "Could not render the preview." }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [markdown, settings, enabled]);

  return preview;
}

/** Explains what the renderer could not parse, from its own section counts. */
export function parseHint(stats: CvPreviewStats | null): string {
  if (!stats) return "";
  const { summary, experience, projects, education, skills, competencies } = stats;
  if (!summary && !experience && !projects && !education && !skills && !competencies) {
    return "Only the header could be parsed. The renderer reads ## Professional Summary, ## Experience, ## Skills and ## Education headings.";
  }
  if (!experience) return "No roles parsed — under ## Experience, start each role with ### Company — Location.";
  if (!skills && !competencies) return "No skills parsed — add a ## Skills section.";
  return "";
}
