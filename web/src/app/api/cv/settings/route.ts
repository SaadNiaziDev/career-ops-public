import { NextResponse } from "next/server";
import { resolveCvSource } from "@/lib/cv/sources";
import {
  listCvTemplates,
  readCvSettings,
  sanitizeCvPageFormat,
  sanitizeCvStyle,
  sanitizeCvTemplate,
  writeCvSettings,
  type CvPageFormat,
} from "@/lib/cv/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = readCvSettings();
  return NextResponse.json({ ...settings, templates: listCvTemplates() });
}

export async function POST(req: Request) {
  let body: { template?: unknown; source?: unknown; pageFormat?: unknown; style?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const patch: {
    template?: string;
    source?: string;
    pageFormat?: CvPageFormat;
    style?: ReturnType<typeof sanitizeCvStyle>;
  } = {};

  if (body.pageFormat !== undefined) {
    const pageFormat = sanitizeCvPageFormat(body.pageFormat);
    if (!pageFormat) return NextResponse.json({ error: "page format must be a4 or letter" }, { status: 400 });
    patch.pageFormat = pageFormat;
  }

  if (body.template !== undefined) {
    const template = sanitizeCvTemplate(body.template);
    if (!template) return NextResponse.json({ error: "unknown template" }, { status: 400 });
    patch.template = template;
  }

  if (body.source !== undefined) {
    const source = typeof body.source === "string" ? body.source.trim() : "";
    if (!source || !resolveCvSource(source)) return NextResponse.json({ error: "invalid source path" }, { status: 400 });
    patch.source = source;
  }

  if (body.style !== undefined) {
    const style = sanitizeCvStyle(body.style);
    // Reject outright rather than silently dropping: a colour the renderer would
    // ignore is a setting the user thinks they saved.
    if (Object.keys(style).length === 0) return NextResponse.json({ error: "no valid style values" }, { status: 400 });
    patch.style = style;
  }

  try {
    writeCvSettings(patch);
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...readCvSettings() });
}
