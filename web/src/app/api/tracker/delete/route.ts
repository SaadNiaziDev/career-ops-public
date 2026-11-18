import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remove one application from Track. Soft delete: the row stays in SQLite with
// deleted = 1, so a later import of applications.md never brings it back.
export async function POST(req: Request) {
  let body: { n?: string | number; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const num = String(body.n ?? "").trim();
  if (!/^\d+$/.test(num)) {
    return Response.json({ error: "a numeric application number is required" }, { status: 400 });
  }
  const exists = db().prepare("SELECT 1 FROM applications WHERE n = ? AND deleted = 0").get(Number(num));
  if (!exists) return Response.json({ error: `No application numbered ${num}` }, { status: 404 });
  const dryRun = !!body.dryRun;
  if (!dryRun) db().prepare("UPDATE applications SET deleted = 1, updated_at = ? WHERE n = ?").run(new Date().toISOString(), Number(num));
  return Response.json({ ok: true, dryRun, orphanReport: null });
}
