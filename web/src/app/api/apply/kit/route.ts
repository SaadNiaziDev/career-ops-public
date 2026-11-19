import { buildKit, buildQueue } from "@/lib/apply/kit-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only Apply-kit state. GET ?n=<tracker#> → one kit (CV, answers snapshot,
// cover draft, profile facts). GET without n → the apply queue (Evaluated, 4.0+).
// Writes go through the existing endpoints: /api/run (pdf/cover workers),
// /api/apply/snapshot (answers) and /api/status (Applied, confirm-gated).
export async function GET(req: Request) {
  const n = new URL(req.url).searchParams.get("n")?.trim() ?? "";
  if (!n) return Response.json({ queue: buildQueue(0) }, { headers: { "Cache-Control": "no-store" } });
  if (!/^\d{1,6}$/.test(n)) return Response.json({ error: "valid tracker number required" }, { status: 400 });
  const kit = buildKit(n);
  if (!kit) return Response.json({ error: `No tracker row #${n}` }, { status: 404 });
  return Response.json({ kit }, { headers: { "Cache-Control": "no-store" } });
}
