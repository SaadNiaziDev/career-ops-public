import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveCli } from "@/lib/clis";
import { careerOpsRoot, readMemory } from "@/lib/career-ops";
import { assembleDedupContext } from "@/lib/core/discover";
import { USAGE_MARK } from "@/lib/explore";
import { spawnSandboxedWorker, terminateWorkerProcess, workerRoots, WorkerCapacityError } from "@/lib/worker-sandbox";
import { untrustedContent, withPromptSecurityHeader } from "@/lib/untrusted-content";
import { readBoundedJson, RequestTooLargeError } from "@/lib/core/request-bounds";
import { workerClientId } from "@/lib/core/worker-admission";

// AI search orchestrates modes/discover.md by running the USER'S configured CLI
// headless (CLI-agnostic, like the assistant). Web hunting is slow → generous
// budget. The agent is a PROPOSER: Write/Edit/Bash are disabled so it structurally
// cannot persist; the only writes happen when the user later ADDs a candidate.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
const MAX_SEARCH_BODY_BYTES = 64_000;
const MAX_SEARCH_QUERY_BYTES = 8_000;
const MAX_SEARCH_PROMPT_BYTES = 128_000;

const OUTPUT_CONTRACT = `

--- OUTPUT CONTRACT (the career-ops WEB is parsing your stream) ---
Follow modes/discover.md exactly. You are running headless for the web:
- You are a PROPOSER — never write a file (Write/Edit/Bash are disabled).
- Ordinary web search is allowed for public job postings and publicly indexed company/recruiter hiring posts. Never scrape LinkedIn, log in, or automate authenticated browsing.
- Classify direct job detail pages as kind=vacancy. Classify public hiring announcements without a direct, verified job detail as kind=hiring-signal; they are leads only, never job vacancies.
- Include a public source label and a discovery time is added by the UI. Include postedAt only when a precise date is visible; otherwise use postedHint or unknown.
- Emit each candidate as ONE line, never inside a code fence:
  <<offer:{"url":"…","title":"…","company":"…","location":"…","source":"ai-search","why":"…","postedHint":"…","ats":"…","verification":"unconfirmed","kind":"vacancy|hiring-signal","discoveredFrom":"public source name","postedAt":"YYYY-MM-DD when reliably visible"}>>
  Valid JSON, one per line, the moment you're confident — stream them as you go.
- Between envelopes, narrate briefly (plain text) what you're searching — shown live as your reasoning.
- Be frugal (~3–6 searches, stop at a strong set). Prefer direct ATS URLs over aggregator mirrors. EVERY envelope starts as UNVERIFIED — the web UI then liveness-checks and drops expired links before showing them.
- Be a GENEROUS FINDER, not a judge: when a constraint (location, seniority, stage) can't be confirmed from the shallow signal, INCLUDE + flag the uncertainty in "why" — don't discard. NEVER score or judge fit; the A–F evaluation does that later, with the full JD.
- DEDUP: skip anything already known below; don't re-propose the user's existing companies.
`;

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

  const resolved = resolveCli(cliId);
  if (!resolved) return Response.json({ error: `CLI '${cliId}' not found on this machine` }, { status: 404 });
  const { spec, binPath } = resolved;

  // Read the CANONICAL mode at request time — single source of truth, never a
  // homegrown prompt. Missing (older core) → graceful 400 so the Scan tab stays usable.
  let mode: string;
  try {
    mode = fs.readFileSync(path.join(careerOpsRoot(), "modes", "discover.md"), "utf8");
  } catch {
    return Response.json(
      { code: "MODE_MISSING", error: "AI search mode file missing (modes/discover.md). Pull the latest career-ops or re-run update-system." },
      { status: 400 },
    );
  }

  const { lines } = assembleDedupContext();
  const memory = readMemory();
  const memoryLine = memory.trim() ? `\n\nWHAT YOU KNOW ABOUT THE USER (persistent memory):\n${untrustedContent("user profile notes", memory.trim())}` : "";
  const knownBlock = lines.length ? `\n\n--- ALREADY KNOWN (dedup — do NOT propose these) ---\n${untrustedContent("existing pipeline data", lines.join("\n"))}` : "";
  const prompt = withPromptSecurityHeader(`${mode}${OUTPUT_CONTRACT}${memoryLine}${knownBlock}\n\n--- USER INTENT ---\n${untrustedContent("search request", query)}\n`);
  if (Buffer.byteLength(prompt, "utf8") > MAX_SEARCH_PROMPT_BYTES) return Response.json({ error: "AI search prompt too large. Shorten the search query and retry." }, { status: 413 });

  const isClaude = cliId === "claude";
  const isCodex = cliId === "codex";
  const args = isClaude
    ? [
        "-p",
        prompt,
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Read,WebFetch,WebSearch,Glob,Grep", // WebSearch ADDED vs the read-only assistant
        "--disallowedTools",
        "Bash,Write,Edit,NotebookEdit,Task", // proposer-not-writer, by construction
      ]
    : spec.args(prompt);

  const root = careerOpsRoot();
  let child;
  try {
    const roots = workerRoots("discover", root);
    child = await spawnSandboxedWorker({ cliId, task: "discover", binPath, args, cwd: os.tmpdir(), scopeRoot: root, ...roots, clientId: workerClientId(req), signal: req.signal, detached: process.platform !== "win32" });
  } catch (error) {
    if (error instanceof WorkerCapacityError) {
      if (error.reason === "cancelled") return new Response(null, { status: 499 });
      return Response.json({ error: error.message }, { status: 429, headers: { "Retry-After": "5" } });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Worker sandbox could not be started." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  // `closed` + kill timer in the OUTER scope so cancel() can flip `closed` before
  // the child's late handlers run — otherwise they enqueue onto an already-closed
  // controller and throw an uncaught "Controller is already closed" (see #1155).
  let closed = false;
  let killer: ReturnType<typeof setTimeout> | undefined;
  let forceKiller: ReturnType<typeof setTimeout> | undefined;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    terminateWorkerProcess(child.pid, "SIGTERM");
    forceKiller = setTimeout(() => terminateWorkerProcess(child.pid, "SIGKILL"), 5_000);
  };
  req.signal.addEventListener("abort", stop, { once: true });
  if (req.signal.aborted) stop();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buf = "";
      let emitted = false;
      killer = setTimeout(() => {
        stop();
      }, 480_000);
      const safeClose = () => {
        if (!closed) {
          closed = true;
          if (killer) clearTimeout(killer);
          if (forceKiller) clearTimeout(forceKiller);
          req.signal.removeEventListener("abort", stop);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      const safeEnqueue = (s: string): boolean => {
        if (closed || !s) return false;
        try {
          controller.enqueue(encoder.encode(s));
          return true;
        } catch {
          closed = true; // controller already closed underneath us — stop, never crash
          return false;
        }
      };
      const emit = (s: string) => {
        if (safeEnqueue(s)) emitted = true;
      };

      child.stdout.on("data", (d: Buffer) => {
        if (closed) return;
        if (isCodex) {
          buf += d.toString();
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            try {
              const ev = JSON.parse(line);
              if (ev.type === "item.completed" && ev.item?.type === "agent_message") {
                const text = ev.item.text;
                if (typeof text === "string") emit(text);
              } else if (ev.type === "turn.completed") {
                const u = ev.usage || {};
                const tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_write_input_tokens || 0);
                if (tokens > 0) emit(`\n${USAGE_MARK}${JSON.stringify({ usd: 0, tokens })}\n`);
              }
            } catch {
              /* Codex may print non-JSON setup lines before JSONL; ignore them. */
            }
          }
          return;
        }
        if (!isClaude) {
          emit(d.toString());
          return;
        }
        buf += d.toString();
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === "stream_event" && obj.event?.type === "content_block_delta") {
              const text = obj.event.delta?.text;
              if (typeof text === "string") emit(text);
            } else if (obj.type === "result") {
              // What the run ACTUALLY cost. Explore shows this next to the
              // estimate it quoted before the run (blueprint S04 · gap 6).
              const usd = Number(obj.total_cost_usd);
              const u = obj.usage ?? {};
              const tokens =
                Number(u.input_tokens ?? 0) +
                Number(u.output_tokens ?? 0) +
                Number(u.cache_read_input_tokens ?? 0) +
                Number(u.cache_creation_input_tokens ?? 0);
              if (Number.isFinite(usd) || tokens > 0) {
                emit(`\n${USAGE_MARK}${JSON.stringify({ usd: Number.isFinite(usd) ? usd : 0, tokens })}\n`);
              }
            }
          } catch {
            /* partial / non-json line — skip */
          }
        }
      });
      child.stderr.on("data", (d: Buffer) => {
        const s = d.toString();
        if (/error|not found|denied|fatal/i.test(s)) {
          safeEnqueue(`\n[${spec.name}] ${s.trim()}\n`);
        }
      });
      child.on("error", (e) => {
        safeEnqueue(`\n[error launching ${spec.name}: ${e.message}]`);
        safeClose();
      });
      child.on("close", () => {
        if (!emitted) safeEnqueue("_(no output — is the CLI authenticated?)_");
        safeClose();
      });
    },
    cancel() {
      closed = true;
      if (killer) clearTimeout(killer);
      req.signal.removeEventListener("abort", stop);
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
