import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, pipelineSummary } from "@/lib/career-ops";
import { removePendingInboxUrl } from "@/lib/core/pipeline-inbox";
import { atomicWrite } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh local files

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

  const file = path.join(careerOpsRoot(), "data/pipeline.md");
  let markdown: string;
  try {
    markdown = fs.readFileSync(file, "utf8");
  } catch {
    return Response.json({ error: "pipeline inbox not found" }, { status: 404 });
  }

  const result = removePendingInboxUrl(markdown, url);
  if (result.removed === 0) {
    return Response.json({ error: "role is no longer in the inbox" }, { status: 404 });
  }

  atomicWrite(file, result.content);
  return Response.json({ ok: true, removed: result.removed });
}
