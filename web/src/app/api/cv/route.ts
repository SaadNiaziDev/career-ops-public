import { NextResponse } from "next/server";
import { DEFAULT_CV_SOURCE, readCvSource, resolveCvSource } from "@/lib/cv/sources";
import { readCvSettings } from "@/lib/cv/settings";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CV_BYTES = 200_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source")?.trim() || readCvSettings().source;
  if (!resolveCvSource(source)) {
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  }
  const data = readCvSource(source);
  return NextResponse.json({ ...data, source, active: source });
}

export async function POST(req: Request) {
  let body: { content?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_CV_BYTES) {
    return NextResponse.json({ error: "CV is too large (over 200KB)" }, { status: 413 });
  }

  const source = body.source?.trim() || DEFAULT_CV_SOURCE;
  const abs = resolveCvSource(source);
  if (!abs) return NextResponse.json({ error: "invalid source path" }, { status: 400 });

  try {
    const bak = atomicWriteWithBackup(abs, body.content);
    return NextResponse.json({ ok: true, backedUp: !!bak, source });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
