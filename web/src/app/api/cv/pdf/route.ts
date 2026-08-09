import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";
import { readCvSource, resolveCvSource, DEFAULT_CV_SOURCE } from "@/lib/cv/sources";
import { renderCvPreviewHtml } from "@/lib/cv/preview";
import { readCvSettings, sanitizeCvPageFormat, sanitizeCvStyle, sanitizeCvTemplate } from "@/lib/cv/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Blueprint S08 — the full preview exports from the LIVE buffer, so a PDF can be
// generated with unsaved edits in the editor. Same render path as the studio
// preview, then Playwright headless via the root generate-pdf.mjs.

const MAX_BYTES = 200_000;

export async function POST(req: Request) {
  let body: {
    content?: string;
    source?: string;
    template?: string;
    pageFormat?: string;
    style?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  let md = typeof body.content === "string" ? body.content : "";
  if (!md.trim()) {
    const rel = (body.source || DEFAULT_CV_SOURCE).trim();
    if (!resolveCvSource(rel)) return NextResponse.json({ error: "invalid source" }, { status: 400 });
    md = readCvSource(rel).content;
  }
  if (!md.trim()) return NextResponse.json({ error: "empty cv content" }, { status: 400 });
  if (Buffer.byteLength(md, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "CV too large" }, { status: 413 });
  }

  const pageFormat = sanitizeCvPageFormat(body.pageFormat) ?? readCvSettings().pageFormat;

  let html: string;
  try {
    html = renderCvPreviewHtml({
      markdown: md,
      template: sanitizeCvTemplate(body.template) ?? undefined,
      pageFormat,
      style: sanitizeCvStyle(body.style) as Record<string, string>,
    }).html;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "render failed" }, { status: 500 });
  }

  const stamp = `${process.pid}-${Date.now()}`;
  const htmlPath = path.join(os.tmpdir(), `co-cv-${stamp}.html`);
  const pdfPath = path.join(os.tmpdir(), `co-cv-${stamp}.pdf`);
  try {
    fs.writeFileSync(htmlPath, html, "utf8");
    const r = spawnSync(
      process.execPath,
      [rootScript("generate-pdf"), htmlPath, pdfPath, `--format=${pageFormat}`],
      { cwd: careerOpsRoot(), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    if (r.status !== 0 || !fs.existsSync(pdfPath)) {
      const detail = (r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" ");
      return NextResponse.json(
        { error: detail || "PDF generation failed — is Playwright installed?" },
        { status: 500 },
      );
    }
    const buf = fs.readFileSync(pdfPath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cv-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "pdf failed" }, { status: 500 });
  } finally {
    for (const f of [htmlPath, pdfPath]) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* best effort */
      }
    }
  }
}
