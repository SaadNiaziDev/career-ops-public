import { NextResponse } from "next/server";
import { DEFAULT_CV_SOURCE, readCvSource, resolveCvSource } from "@/lib/cv/sources";
import { renderCvPreviewHtml } from "@/lib/cv/preview";
import { readCvSettings, sanitizeCvPageFormat, sanitizeCvStyle, sanitizeCvTemplate } from "@/lib/cv/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PREVIEW_BYTES = 200_000;

type PreviewBody = {
  content?: string;
  source?: string;
  template?: string;
  pageFormat?: string;
  style?: Record<string, string>;
};

function resolveMarkdown(body: PreviewBody): { md: string } | { error: string; status: number } {
  let md = typeof body.content === "string" ? body.content : "";
  if (!md.trim() && body.source) {
    const rel = body.source.trim();
    if (!resolveCvSource(rel)) return { error: "invalid source", status: 400 };
    md = readCvSource(rel).content;
  }
  if (!md.trim()) return { error: "empty cv content", status: 400 };
  if (Buffer.byteLength(md, "utf8") > MAX_PREVIEW_BYTES) return { error: "CV too large for preview", status: 413 };
  return { md };
}

export async function POST(req: Request) {
  let body: PreviewBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const resolved = resolveMarkdown(body);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  try {
    const result = renderCvPreviewHtml({
      markdown: resolved.md,
      template: sanitizeCvTemplate(body.template) ?? undefined,
      pageFormat: sanitizeCvPageFormat(body.pageFormat) ?? readCvSettings().pageFormat,
      style: sanitizeCvStyle(body.style) as Record<string, string>,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || DEFAULT_CV_SOURCE;
  if (!resolveCvSource(source)) return NextResponse.json({ error: "invalid source" }, { status: 400 });

  const resolved = resolveMarkdown({ source });
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const style = sanitizeCvStyle({
    accent_color: url.searchParams.get("accent") ?? undefined,
    heading_color: url.searchParams.get("heading") ?? undefined,
    font_stack: url.searchParams.get("font") ?? undefined,
    margin: url.searchParams.get("margin") ?? undefined,
    density: url.searchParams.get("density") ?? undefined,
  }) as Record<string, string>;

  try {
    const result = renderCvPreviewHtml({
      markdown: resolved.md,
      template: sanitizeCvTemplate(url.searchParams.get("template")) ?? undefined,
      pageFormat: sanitizeCvPageFormat(url.searchParams.get("page")) ?? readCvSettings().pageFormat,
      style,
    });
    return new Response(result.html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
