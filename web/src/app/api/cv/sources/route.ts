import { NextResponse } from "next/server";
import { listCvSources, readCvSource, resolveCvSource } from "@/lib/cv/sources";
import { readCvSettings, writeCvSettings } from "@/lib/cv/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listCvSources(readCvSettings().source));
}

export async function POST(req: Request) {
  let body: { source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const source = (body.source ?? "").trim();
  if (!source || !resolveCvSource(source)) {
    return NextResponse.json({ error: "invalid source path" }, { status: 400 });
  }
  try {
    writeCvSettings({ source });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
  const data = readCvSource(source);
  return NextResponse.json({ ok: true, ...listCvSources(source), content: data.content, exists: data.exists });
}
