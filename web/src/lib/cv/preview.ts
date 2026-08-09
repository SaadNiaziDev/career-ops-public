import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

export type CvPreviewStats = {
  summary: boolean;
  experience: number;
  projects: number;
  education: number;
  skills: number;
  competencies: number;
};

export type CvPreviewResult = { html: string; template: string; stats?: CvPreviewStats };

/** Render cv markdown to HTML via the root cv-md-preview.mjs CLI (avoids Next bundler dynamic import). */
export function renderCvPreviewHtml(opts: {
  markdown: string;
  template?: string;
  pageFormat?: "a4" | "letter";
  style?: Record<string, string>;
}): CvPreviewResult {
  const tmp = path.join(os.tmpdir(), `co-cv-preview-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(tmp, opts.markdown, "utf8");
  try {
    const args = [rootScript("cv-md-preview"), "--json", "--file", tmp];
    if (opts.template) args.push("--template", opts.template);
    if (opts.pageFormat) args.push("--page-format", opts.pageFormat);
    if (opts.style && Object.keys(opts.style).length > 0) {
      args.push("--style-json", JSON.stringify(opts.style));
    }
    const r = spawnSync(process.execPath, args, {
      cwd: careerOpsRoot(),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (r.status !== 0) {
      throw new Error(r.stderr?.trim() || r.stdout?.trim() || "CV preview render failed");
    }
    const parsed = JSON.parse(r.stdout.trim()) as CvPreviewResult;
    if (!parsed.html) throw new Error("CV preview returned empty HTML");
    return parsed;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}
