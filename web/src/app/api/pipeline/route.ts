import { pipelineSummary } from "@/lib/career-ops";
import { db } from "@/lib/db";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exposes the user's pipeline (inbox + tracker) to the client so the assistant
// can resolve "all the Anthropic ones" to concrete postings CLIENT-SIDE — the
// model only ever emits a company name, never URLs (no hallucination, no tokens).
export async function GET() {
  const s = pipelineSummary();
  return Response.json({
    inbox: s.inbox,
    applications: s.applications,
    root: s.root,
    rootExists: s.rootExists,
  });
}

export async function DELETE(req: Request) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || url.length > 8_000) {
    return Response.json({ error: "a valid inbox URL is required" }, { status: 400 });
  }

  const key = normalizeVacancyUrl(url) ?? url;
  const result = db().prepare("UPDATE jobs SET removed = 1 WHERE (key = ? OR url = ?) AND done = 0 AND removed = 0").run(key, url);
  if (Number(result.changes) === 0) {
    return Response.json({ error: "role is no longer in the inbox" }, { status: 404 });
  }
  return Response.json({ ok: true, removed: Number(result.changes) });
}
