import { setKv } from "@/lib/db";
import { runScan } from "@/lib/search/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Free scan of company boards + job boards. Streams NDJSON progress events.
export async function POST(req: Request) {
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: unknown) => { try { controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`)); } catch { /* client gone */ } };
      try {
        await runScan(send, abort.signal);
        setKv("search.lastScan", new Date().toISOString());
      } catch (error) {
        send({ type: "error", msg: error instanceof Error ? error.message : "Scan failed." });
      } finally {
        try { controller.close(); } catch { /* closed */ }
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
