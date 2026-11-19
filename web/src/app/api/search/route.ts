import { getKv } from "@/lib/db";
import { listJobs, setDismissed } from "@/lib/search/jobs";
import { readPortals, scanTargets } from "@/lib/search/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ jobs: listJobs(), lastScan: getKv("search.lastScan"), sources: scanTargets(readPortals()).length });
}

/** { key, dismissed } — hide a job from New, or bring it back. */
export async function PATCH(req: Request) {
  let body: { key?: unknown; dismissed?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (typeof body.key !== "string" || !body.key || body.key.length > 4_000) return Response.json({ error: "job key required" }, { status: 400 });
  return setDismissed(body.key, body.dismissed !== false) ? Response.json({ ok: true }) : Response.json({ error: "job not found" }, { status: 404 });
}
