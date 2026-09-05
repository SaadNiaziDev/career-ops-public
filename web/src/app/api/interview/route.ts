import { NextResponse } from "next/server";
import { findApplication } from "@/lib/career-ops";
import { loadInterviewBundle } from "@/lib/interview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = (url.searchParams.get("n") ?? "").trim();
  if (!n || !/^\d+$/.test(n)) {
    return NextResponse.json({ error: "tracker number required" }, { status: 400 });
  }

  const app = findApplication(n);
  if (!app) {
    return NextResponse.json({ error: "application not found" }, { status: 404 });
  }

  const bundle = loadInterviewBundle(n);
  if (!bundle) {
    return NextResponse.json({ error: "could not load interview data" }, { status: 500 });
  }

  return NextResponse.json(bundle);
}
