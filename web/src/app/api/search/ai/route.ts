import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { AgentError, runAgent } from "@/lib/agent";
import { candidateContext, hasCv } from "@/lib/agent-context";
import { assembleDedupContext } from "@/lib/core/discover";
import { searchPrompt } from "@/lib/prompts";
import { addJob } from "@/lib/search/jobs";
import { untrustedContent } from "@/lib/untrusted-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

// AI web search: the agent streams <<offer:{...}>> lines; each valid one is saved to
// the inbox right away and sent to the page. Other text is narration.
export async function POST(req: Request) {
  let body: { query?: unknown; cliId?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const query = (typeof body.query === "string" ? body.query.trim().slice(0, 2_000) : "") || "Jobs matching my target roles, location rules and profile.";
  const cliId = typeof body.cliId === "string" ? body.cliId : "";
  if (!cliId) return Response.json({ error: "Pick an AI engine in Settings first." }, { status: 400 });
  if (!hasCv()) return Response.json({ error: "Add your CV first (Brain) so the search matches you." }, { status: 400 });

  let portals = "";
  try { portals = untrustedContent("portals.yml", fs.readFileSync(path.join(careerOpsRoot(), "portals.yml"), "utf8").slice(0, 30_000)); } catch { /* optional */ }
  const { lines } = assembleDedupContext();
  const prompt = searchPrompt({
    query: untrustedContent("search request", query),
    known: lines.length ? untrustedContent("already known", lines.join("\n")) : "(nothing yet)",
    portals,
    candidate: candidateContext(),
    today: new Date().toISOString().slice(0, 10),
  });

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: unknown) => { try { controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`)); } catch { /* client gone */ } };
      let buffer = "";
      let added = 0;
      const handleLine = (line: string) => {
        const m = line.match(/<<offer:(\{.*\})>>/);
        if (!m) {
          const note = line.replace(/[`*_#>]/g, "").trim();
          if (note) send({ type: "note", text: note.slice(0, 300) });
          return;
        }
        try {
          const o = JSON.parse(m[1]) as Record<string, unknown>;
          const url = String(o.url ?? "");
          if (!/^https:\/\//i.test(url)) return;
          const job = { url, company: String(o.company ?? "").slice(0, 120), role: String(o.title ?? "").slice(0, 200), location: String(o.location ?? "").slice(0, 160), source: "AI search", kind: String(o.kind ?? "vacancy"), why: String(o.why ?? "").slice(0, 400), postedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(o.postedAt)) ? String(o.postedAt) : undefined };
          if (addJob(job)) { added += 1; send({ type: "job", job }); }
        } catch { /* malformed offer line */ }
      };
      try {
        send({ type: "note", text: "Searching the web…" });
        await runAgent({
          cliId, prompt, web: true, timeoutMs: 480_000, signal: abort.signal,
          onEvent: (e) => {
            if (e.type === "tool") send({ type: "note", text: e.name === "WebFetch" ? "Opening a page…" : "Searching…" });
            if (e.type !== "text") return;
            buffer += e.text;
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) { handleLine(buffer.slice(0, nl)); buffer = buffer.slice(nl + 1); }
          },
        });
        if (buffer.trim()) handleLine(buffer);
        send({ type: "done", added });
      } catch (error) {
        if (buffer.trim()) handleLine(buffer);
        if (error instanceof AgentError && error.status === 499) send({ type: "done", added, cancelled: true });
        else send({ type: "error", msg: error instanceof Error ? error.message : "AI search failed.", added });
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
