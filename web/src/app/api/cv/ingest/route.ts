import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveCli, resolveDefaultCli } from "@/lib/clis";
import { careerOpsRoot } from "@/lib/career-ops";
import { extractPdfText } from "@/lib/cv/pdf-text.mjs";
import { localCvStream } from "@/lib/cv/quality";

// Parse a CV (pasted text or an uploaded PDF) into clean cv.md markdown.
// PDFs are extracted locally first so any CLI (or no CLI) can continue — the
// real CV NEVER leaves the machine. This route is a PROPOSER: it produces
// candidate markdown only; the actual write to cv.md happens via POST /api/cv
// after the user confirms (propose-then-confirm).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Prefer the CANONICAL core mode (single source of truth — CLI + web parse CVs
// identically); fall back to the inline prompt until modes/cv-ingest.md lands
// (exactly how the explore route handles a missing discover.md).
function readCanonicalMode(): string | null {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), "modes", "cv-ingest.md"), "utf8");
  } catch {
    return null;
  }
}

function ingestPrompt(source: string): string {
  const mode = readCanonicalMode();
  if (mode) {
    return `${mode}\n\n--- HEADLESS OUTPUT CONTRACT (the career-ops WEB is parsing your stream) ---\nFollow the mode above exactly. You are a PROPOSER running headless: emit ONLY the markdown between <<cv:start>> and <<cv:end>> (own lines, never in a code fence), then one <<cv:seed>>{...} line; or <<cv:error>>{"reason":"unreadable"} if you can't read it. Narrate one short line before <<cv:start>>.\n\n${source}`;
  }
  // Fallback mirrors the canonical examples/cv-example.md format (the SSOT the
  // project ships) so a web-parsed CV is the same shape as a hand-written one.
  return `You convert a person's CV into clean cv.md markdown that EXACTLY mirrors career-ops's reference format.

FORMAT (match exactly; omit a section if the source lacks it; INVENT NOTHING):
\`# CV -- {Full Name}\`
then bold contact lines directly under the title (no "Contact" section):
\`**Location:** …\` / \`**Email:** …\` / \`**LinkedIn:** …\` / \`**Portfolio:** …\` / \`**GitHub:** …\`
\`## Professional Summary\` — a 2-4 line summary, only from facts present.
\`## Work Experience\` — each role as: \`### {Company} -- {Location}\`, then \`**{Job Title}**\` on its own line, then \`{Start}-{End or Present}\` on its own line, then bullet points (preserve EVERY quantified achievement verbatim).
\`## Projects\` — flat bullets: \`- **{Name}** ({type}) -- {what + hero metric}\`.
\`## Education\` — flat bullets: \`- {Degree}, {Institution} ({year})\`.
\`## Skills\` — grouped bullets: \`- **{Category}:** {comma list}\`.
Use \`--\` (double hyphen), NEVER an em dash (ATS rule). Preserve every company/title/date/metric. Clean, don't rewrite — it's THEIR CV.

OUTPUT PROTOCOL:
- You are a PROPOSER: do NOT write any file. Emit ONLY the markdown wrapped EXACTLY between a line \`<<cv:start>>\` and a line \`<<cv:end>>\` (each on its own line, never inside a code fence).
- After \`<<cv:end>>\`, emit ONE more line: \`<<cv:seed>>{"title":"<their current/target role>","roles":["<3-5 role keywords>"],"location":"<their location or 'Remote'>"}\`
- If the source is unreadable or empty, emit ONLY: \`<<cv:error>>{"reason":"unreadable"}\` and stop.
- Narrate one short line BEFORE \`<<cv:start>>\` (e.g. "Reading your CV…").

${source}`;
}

const TEXT_SRC = (t: string) => `SOURCE (the user's CV, pasted as text — convert it):\n"""\n${t.slice(0, 24000)}\n"""`;

function localResponse(markdown: string, trace = "Reading your CV…") {
  return new Response(localCvStream(markdown, trace), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  let cliId = "";
  let promptSource = "";
  let extractedText = "";

  try {
    if (ctype.includes("application/json")) {
      const body = (await req.json()) as { text?: string; cliId?: string };
      cliId = body.cliId || "";
      const text = (body.text || "").trim();
      if (!text) return Response.json({ error: "empty cv text" }, { status: 400 });
      extractedText = text;
      promptSource = TEXT_SRC(text);
    } else if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      cliId = String(form.get("cliId") || "");
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });
      if (/\.docx$/i.test(file.name)) {
        return Response.json({ error: "Word .docx isn't supported yet — export as PDF or Markdown (.md), or paste the text." }, { status: 400 });
      }
      const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".pdf").toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());
      if (/\.(md|markdown|txt)$/i.test(file.name)) {
        const text = buf.toString("utf8").trim();
        if (!text) return Response.json({ error: "empty file" }, { status: 400 });
        extractedText = text;
        promptSource = TEXT_SRC(text);
      } else if (ext === ".pdf" || buf.subarray(0, 5).toString("latin1") === "%PDF-") {
        const text = extractPdfText(buf);
        if (!text || text.trim().length < 40) {
          return Response.json({ error: "Couldn't read text from that PDF (it may be a scanned image). Export as .md or paste the text instead." }, { status: 400 });
        }
        extractedText = text.trim();
        promptSource = TEXT_SRC(extractedText);
      } else {
        return Response.json({ error: "Use a PDF, .md, or .txt file — or paste the CV text." }, { status: 400 });
      }
    } else {
      return Response.json({ error: "unsupported content-type" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const resolved = cliId ? resolveCli(cliId) : null;
  const active = resolved ? { cliId, ...resolved } : resolveDefaultCli();
  if (!active) {
    if (extractedText) return localResponse(extractedText);
    return Response.json({ error: "Connect an AI CLI in Config, or paste / drop a .md file." }, { status: 404 });
  }
  const { spec, binPath, cliId: activeCliId } = active;
  const prompt = ingestPrompt(promptSource);
  const isClaude = activeCliId === "claude";
  const isCodex = activeCliId === "codex";
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
        "Read,Glob,Grep",
        "--disallowedTools",
        "Bash,Write,Edit,NotebookEdit,Task,WebFetch,WebSearch",
      ]
    : spec.args(prompt);

  let child;
  try {
    child = spawn(binPath, args, { cwd: careerOpsRoot(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed to start the CLI" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  // The `closed` flag + kill timer live in the OUTER scope so the ReadableStream
  // `cancel()` callback (fired on client disconnect / response teardown) can flip
  // `closed` BEFORE the child's late close/error/stderr handlers run — otherwise
  // they enqueue onto an already-closed controller and throw an UNCAUGHT
  // "Invalid state: Controller is already closed" that crashes the server (#1155).
  let closed = false;
  let killer: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buf = "";
      let emitted = false;
      killer = setTimeout(() => {
        try {
          child.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      }, 240_000);
      const safeClose = () => {
        if (!closed) {
          closed = true;
          if (killer) clearTimeout(killer);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      // Every write goes through here: guarded on `closed` AND try/catch'd, so a
      // lost race with cancel()/close can never throw out of an EventEmitter cb.
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
            }
          } catch {
            /* partial / non-json line */
          }
        }
      });
      child.stderr.on("data", (d: Buffer) => {
        const s = d.toString();
        if (/error|not found|denied|fatal/i.test(s)) safeEnqueue(`\n[${spec.name}] ${s.trim()}\n`);
      });
      child.on("error", (e) => {
        safeEnqueue(`\n[error launching ${spec.name}: ${e.message}]`);
        safeClose();
      });
      child.on("close", () => {
        if (!emitted) safeEnqueue("<<cv:error>>{\"reason\":\"no-output\"}");
        safeClose();
      });
    },
    cancel() {
      closed = true; // a consumer teardown must stop the child handlers from enqueuing
      if (killer) clearTimeout(killer);
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
