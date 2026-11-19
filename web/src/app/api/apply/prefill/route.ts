import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { runAgent } from "@/lib/agent";
import { candidateContext } from "@/lib/agent-context";
import { getSession } from "@/lib/apply/session";
import { untrustedContent, withPromptSecurityHeader } from "@/lib/untrusted-content";
import { readBoundedJson, RequestTooLargeError } from "@/lib/core/request-bounds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 320;
const MAX_PREFILL_BODY_BYTES = 16_000;
const MAX_PREFILL_PROMPT_BYTES = 300_000;

/**
 * Pull a JSON object out of an LLM's text answer, tolerating code fences,
 * trailing prose, and — crucially — TRUNCATION (the planner getting killed
 * mid-output on a big form). When the object is incomplete we salvage the
 * largest valid prefix so the fields that DID finish still come through.
 */
function extractJsonObject(text: string): { obj: Record<string, unknown> | null; truncated: boolean } {
  const s = text.replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  if (start === -1) return { obj: null, truncated: false };

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end !== -1) {
    try {
      return { obj: JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>, truncated: false };
    } catch {
      /* malformed even though balanced — fall through to salvage */
    }
  }

  // Truncated / unbalanced: walk back from successive commas, close the JSON,
  // and parse the largest prefix that is valid.
  const frag = s.slice(start);
  const open = (frag.match(/{/g) || []).length;
  const close = (frag.match(/}/g) || []).length;
  const pad = "}".repeat(Math.max(0, open - close));
  for (let tryEnd = frag.length; tryEnd > 1; ) {
    const cand = frag.slice(0, tryEnd).replace(/,\s*$/, "") + pad;
    try {
      return { obj: JSON.parse(cand) as Record<string, unknown>, truncated: true };
    } catch {
      const prevComma = frag.lastIndexOf(",", tryEnd - 1);
      if (prevComma <= start) break;
      tryEnd = prevComma;
    }
  }
  return { obj: null, truncated: true };
}

// AI pre-fill (STREAMING NDJSON). The user's BYO CLI (read-only PLANNER — no
// browser access) drafts an answer per field from cv.md / profile / the job's
// report. We stream a live diagnostic log of every step (spawn, heartbeats,
// exit code/signal, parse outcome) so a stuck/empty prefill is observable on the
// page AND written to <root>/.career-ops-web/apply-prefill.log for debugging.
export async function POST(req: Request) {
  let body: { sessionId?: string; cliId?: string };
  try {
    body = await readBoundedJson(req, MAX_PREFILL_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestTooLargeError) return Response.json({ error: "Prefill request too large (max 16 KB). Retry with a smaller request." }, { status: 413 });
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { sessionId, cliId } = body;
  if (typeof sessionId !== "string" || sessionId.length > 128 || typeof cliId !== "string" || cliId.length > 32) {
    return Response.json({ error: "valid sessionId and cliId required" }, { status: 400 });
  }
  const t0 = Date.now();
  const encoder = new TextEncoder();
  const logPath = path.join(careerOpsRoot(), ".career-ops-web", "apply-prefill.log");
  const workerAbort = new AbortController();
  const abortFromRequest = () => workerAbort.abort();
  req.signal.addEventListener("abort", abortFromRequest, { once: true });
  if (req.signal.aborted) workerAbort.abort();
  let responseClosed = false;
  let cancelWorker = () => workerAbort.abort();
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
  } catch {
    /* ignore */
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* client gone */
        }
      };
      const log = (m: string) => {
        const el = Date.now() - t0;
        emit({ t: "log", m, el });
        try {
          fs.appendFileSync(logPath, `${new Date(t0 + el).toISOString()} [+${(el / 1000).toFixed(1)}s] ${m}\n`);
        } catch {
          /* ignore */
        }
      };
      const fail = (m: string, raw?: string) => {
        if (responseClosed) return;
        log(`ERROR: ${m}`);
        emit({ t: "error", m, raw });
        responseClosed = true;
        req.signal.removeEventListener("abort", abortFromRequest);
        controller.close();
      };
      try {
        fs.appendFileSync(logPath, `\n===== prefill ${new Date(t0).toISOString()} session=${sessionId} cli=${cliId} =====\n`);
      } catch {
        /* ignore */
      }

      const s = sessionId ? getSession(sessionId) : undefined;
      if (!s) return fail("apply session not found (it may have expired)");
      const fieldsList = s.fields
        .map((f) => `${f.id}\t${f.type}${f.required ? "*" : ""}\t${f.label}${f.options ? `\t[options: ${f.options.join(" | ")}]` : ""}`)
        .join("\n");
      const prompt = withPromptSecurityHeader(`You are pre-filling a job application for the user (company/role): ${untrustedContent("job title", s.title)}. Ground EVERY answer in the candidate sources below; never invent facts. No tools.

FIELDS (id ⇥ type ⇥ label ⇥ options):
${untrustedContent("external application form", fieldsList)}

For each field give the best answer:
- identity/contact (name, email, phone, github, linkedin, location) → from profile/cv.
- free-text (Why us?, cover-letter, "most impactful thing you've built", etc.) → a concise, honest, concrete answer in the candidate's own voice (no buzzwords, active voice, real metrics only). Keep each under ~120 words.
- select/radio → choose the best-matching option using the EXACT option text from the list.
- NEVER fill legal / visa / work-authorization / salary / demographic / sensitive fields → set needs_confirmation:true and value:"".

Output ONLY a compact JSON object mapping each field id → {"value": "...", "needs_confirmation": boolean}. No prose, no markdown, no code fence.

${candidateContext({ voice: true })}`);
      if (Buffer.byteLength(prompt, "utf8") > MAX_PREFILL_PROMPT_BYTES) return fail("Application form is too large to prefill safely. Reduce the number or length of its fields.");

      log(`Form: "${s.title}" · ${s.fields.length} fields · prompt ${prompt.length} chars`);
      const killMs = Math.min(300_000, 150_000 + s.fields.length * 6_000);
      log(`Running ${cliId} (timeout ${Math.round(killMs / 1000)}s)…`);
      const hb = setInterval(() => log(`…running ${Math.round((Date.now() - t0) / 1000)}s`), 4000);
      let plannerText = "";
      try {
        plannerText = (await runAgent({ cliId, prompt, timeoutMs: killMs, signal: workerAbort.signal })).text;
      } catch (error) {
        return fail(error instanceof Error ? error.message : "The AI engine failed.");
      } finally {
        clearInterval(hb);
        req.signal.removeEventListener("abort", abortFromRequest);
      }
      log(`Answer: ${plannerText.length} chars`);

      const { obj, truncated } = extractJsonObject(plannerText);
      if (!obj) {
        return fail(
          "couldn't parse the planner's answer as JSON",
          plannerText.slice(-300),
        );
      }
      const count = Object.keys(obj).length;
      log(`Parsed ${count} answers${truncated ? " (RECOVERED from truncated output — some fields may be missing)" : ""}`);
      emit({ t: "done", answers: obj, truncated, count });
      controller.close();
    },
    cancel() {
      responseClosed = true;
      req.signal.removeEventListener("abort", abortFromRequest);
      cancelWorker();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
