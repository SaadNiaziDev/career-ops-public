import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { DEFAULT_CV_SOURCE, resolveCvSource } from "@/lib/cv/sources";
import { DEFAULT_PAGE_FORMAT, type CvPageFormat } from "@/lib/cv/page";

export type { CvPageFormat };

// Single owner of the `cv:` block in config/profile.yml. Every CV route reads and
// writes through here so the profile can never gain a key the PDF renderer would
// choke on — style values land inside a <style> block in the generated CV.

export type CvStyle = {
  accent_color: string;
  heading_color: string;
  font_stack: string;
  margin: string;
  density: string;
};

export type CvTemplate = { name: string; displayName: string };

export type CvSettings = {
  template: string;
  source: string;
  pageFormat: CvPageFormat;
  style: CvStyle;
};

export const DEFAULT_CV_STYLE: CvStyle = {
  accent_color: "#2563eb",
  heading_color: "#1a1a2e",
  font_stack: "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif",
  margin: "2px 0",
  density: "standard",
};

export const CV_DENSITIES = ["compact", "standard", "spacious"] as const;

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
// Font stacks are CSS identifier/quoted-string lists — no braces, semicolons or url().
const FONT_STACK_RE = /^[A-Za-z0-9 '",._-]{1,160}$/;
// Page padding: one to four CSS lengths (`0`, `2px 0`, `4px 8px`).
const MARGIN_RE = /^(0|-?\d{1,3}(\.\d+)?(px|pt|mm|cm|em|rem|%))( +(0|-?\d{1,3}(\.\d+)?(px|pt|mm|cm|em|rem|%))){0,3}$/;
const TEMPLATE_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function profilePath(): string {
  return path.join(careerOpsRoot(), "config", "profile.yml");
}

export function readProfile(): Record<string, unknown> {
  try {
    return (yaml.load(fs.readFileSync(profilePath(), "utf8")) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

function cvBlock(profile: Record<string, unknown>): Record<string, unknown> {
  const cv = profile.cv;
  return cv && typeof cv === "object" && !Array.isArray(cv) ? ({ ...(cv as Record<string, unknown>) }) : {};
}

// The CLI listing costs a node spawn and the template set changes only when files
// on disk do — cache it briefly so live preview keystrokes don't fork per request.
const TEMPLATE_TTL_MS = 30_000;
let templateCache: { at: number; templates: CvTemplate[] } | null = null;

/** Templates shipped in `templates/` (+ user overrides), via the root CLI. */
export function listCvTemplates(): CvTemplate[] {
  if (templateCache && Date.now() - templateCache.at < TEMPLATE_TTL_MS) return templateCache.templates;
  const templates = loadCvTemplates();
  templateCache = { at: Date.now(), templates };
  return templates;
}

function loadCvTemplates(): CvTemplate[] {
  const fallback: CvTemplate[] = [{ name: "standard", displayName: "Standard" }];
  const r = spawnSync(process.execPath, [rootScript("cv-templates"), "list", "cv"], {
    cwd: careerOpsRoot(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout?.trim()) return fallback;
  try {
    const parsed = JSON.parse(r.stdout) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const templates = parsed
      .filter((t): t is CvTemplate => !!t && typeof t === "object" && typeof (t as CvTemplate).name === "string")
      .map((t) => ({ name: t.name, displayName: t.displayName || t.name }));
    return templates.length ? templates : fallback;
  } catch {
    return fallback;
  }
}

/** Keep only style keys the renderer understands, with values it can safely emit. */
export function sanitizeCvStyle(input: unknown): Partial<CvStyle> {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: Partial<CvStyle> = {};
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");

  const accent = str("accent_color");
  if (COLOR_RE.test(accent)) out.accent_color = accent.toLowerCase();

  const heading = str("heading_color");
  if (COLOR_RE.test(heading)) out.heading_color = heading.toLowerCase();

  const font = str("font_stack");
  if (FONT_STACK_RE.test(font)) out.font_stack = font;

  const margin = str("margin");
  if (MARGIN_RE.test(margin)) out.margin = margin;

  const density = str("density").toLowerCase();
  if ((CV_DENSITIES as readonly string[]).includes(density)) out.density = density;

  return out;
}

/** A template name is valid only if it is one the CLI actually resolves. */
export function sanitizeCvTemplate(input: unknown, templates = listCvTemplates()): string | null {
  if (typeof input !== "string") return null;
  const name = input.trim();
  if (!TEMPLATE_RE.test(name)) return null;
  return templates.some((t) => t.name === name) ? name : null;
}

export function sanitizeCvPageFormat(input: unknown): CvPageFormat | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  return v === "a4" || v === "letter" ? v : null;
}

export function readCvSettings(): CvSettings {
  const cv = cvBlock(readProfile());
  const style = sanitizeCvStyle(cv.style);
  const template = typeof cv.template === "string" ? cv.template.trim() : "";
  const source = typeof cv.source === "string" ? cv.source.trim() : "";
  return {
    template: TEMPLATE_RE.test(template) ? template : "standard",
    source: source && resolveCvSource(source) ? source : DEFAULT_CV_SOURCE,
    pageFormat: sanitizeCvPageFormat(cv.page_format) ?? DEFAULT_PAGE_FORMAT,
    style: { ...DEFAULT_CV_STYLE, ...style },
  };
}

/** Merge a validated patch into `cv:` and rewrite profile.yml atomically. */
export function writeCvSettings(patch: {
  template?: string;
  source?: string;
  pageFormat?: CvPageFormat;
  style?: Partial<CvStyle>;
}): void {
  const profile = readProfile();
  const cv = cvBlock(profile);
  if (patch.template) cv.template = patch.template;
  if (patch.source) cv.source = patch.source;
  if (patch.pageFormat) cv.page_format = patch.pageFormat;
  if (patch.style && Object.keys(patch.style).length > 0) {
    const current = (cv.style && typeof cv.style === "object" ? cv.style : {}) as Record<string, string>;
    cv.style = { ...current, ...patch.style };
  }
  profile.cv = cv;
  atomicWriteWithBackup(profilePath(), yaml.dump(profile, { lineWidth: 100, noRefs: true }));
}
