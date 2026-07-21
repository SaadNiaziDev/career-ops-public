import { NextResponse } from "next/server";
import { listDrafts, readDraft, type DraftKind } from "@/lib/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set<DraftKind>(["cover", "email", "contacto"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = url.searchParams.get("n") ?? "";
  const kind = url.searchParams.get("kind") ?? "";

  if (n && kind && KINDS.has(kind as DraftKind)) {
    const content = readDraft(n, kind as DraftKind);
    if (!content) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ trackerNum: n, kind, content });
  }

  const tracker = n || undefined;
  return NextResponse.json({ drafts: listDrafts(tracker) });
}
