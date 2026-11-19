import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { AgentError, runAgent } from "@/lib/agent";
import { candidateContext } from "@/lib/agent-context";
import { searchPrompt } from "@/lib/prompts";
import { assembleDedupContext } from "@/lib/core/discover";
import { USAGE_MARK } from "@/lib/explore";
import { untrustedContent } from "@/lib/untrusted-content";
import { readBoundedJson, RequestTooLargeError } from "@/lib/core/request-bounds";

// AI search: the agent searches the public web (job boards, ATS pages, public
// LinkedIn/Reddit/X posts) and streams <<offer:{...}>> lines. It cannot write
// anything; results are saved only when the user adds them.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
const MAX_SEARCH_BODY_BYTES = 64_000;
const MAX_SEARCH_QUERY_BYTES = 8_000;

export async function POST(req: Request) {
  let body: { query?: string; cliId?: string };
  try {
    body = await readBoundedJson(req, MAX_SEARCH_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestTooLargeError) return Response.json({ error: "AI search request too large (max 63 KB). Shorten your query and retry." }, { status: 413 });
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const query = (body.query || "").trim();
  const cliId = body.cliId;
  if (!query || !cliId) return Response.json({ error: "query and cliId required" }, { status: 400 });
  if (Buffer.byteLength(query, "utf8") > MAX_SEARCH_QUERY_BYTES) return Response.json({ error: "AI search query too large (max 8 KB). Shorten it and retry." }, { status: 413 });

  const { lines } = assembleDedupContext();
  let portals = "";
  try { portals = untrustedContent("portals.yml", fs.readFileSync(path.join(careerOpsRoot(), "portals.yml"), "utf8").slice(0, 30_000)); } catch { /* optional */ }
  const prompt = searchPrompt({
    query: untrustedContent("search request", query),
    known: lines.length ? untrustedContent("existing pipeline data", lines.join("\n")) : "(nothing yet)",
    portals,
    candidate: candidateContext(),
    today: new Date().toISOString().slice(0, 10),
  });

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let emitted = false;
      const enqueue = (text: string) => {
        if (closed || !text) return;
        try { controller.enqueue(encoder.encode(text)); emitted = true; } catch { closed = true; }
      };
      try {
        await runAgent({
          cliId, prompt, web: true, timeoutMs: 480_000, signal: abort.signal,
          onEvent: (e) => {
            if (e.type === "text") enqueue(e.text);
            else if (e.type === "usage" && e.tokens > 0) enqueue(`\n${USAGE_MARK}${JSON.stringify({ usd: e.costUsd ?? 0, tokens: e.tokens })}\n`);
          },
        });
        if (!emitted) enqueue("_(no output — is the AI engine signed in?)_");
      } catch (error) {
        if (!(error instanceof AgentError && error.status === 499)) enqueue(`\n[error: ${error instanceof Error ? error.message : "AI search failed"}]\n`);
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { abort.abort(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
