import { resolveCli, resolveDefaultCli } from "@/lib/clis";
import { extractPdfText } from "@/lib/cv/pdf-text.mjs";
import { localCvStream } from "@/lib/cv/quality";
import { AgentError, runAgent } from "@/lib/agent";
import { untrustedContent, withPromptSecurityHeader } from "@/lib/untrusted-content";
import { readBoundedFormData, readBoundedJson, RequestTooLargeError } from "@/lib/core/request-bounds";

// Parse a CV (pasted text or an uploaded PDF) into clean cv.md markdown.
// PDFs are extracted locally first so any CLI (or no CLI) can continue — the
// real CV NEVER leaves the machine. This route is a PROPOSER: it produces
// candidate markdown only; the actual write to cv.md happens via POST /api/cv
// after the user confirms (propose-then-confirm).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const MAX_UPLOAD_BYTES = 5_000_000;
const MAX_TEXT_BYTES = 200_000;
const MAX_JSON_BYTES = 250_000;

function ingestPrompt(source: string): string {
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

const TEXT_SRC = (t: string) => `SOURCE (the user's CV, pasted as text — convert it):\n${untrustedContent("uploaded CV", t.slice(0, 24000))}`;

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
      const body = await readBoundedJson<{ text?: string; cliId?: string }>(req, MAX_JSON_BYTES);
      cliId = body.cliId || "";
      const text = (body.text || "").trim();
      if (!text) return Response.json({ error: "empty cv text" }, { status: 400 });
      if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) return Response.json({ error: "CV text too large (max 200 KB)" }, { status: 413 });
      extractedText = text;
      promptSource = TEXT_SRC(text);
    } else if (ctype.includes("multipart/form-data")) {
      const form = await readBoundedFormData(req, MAX_UPLOAD_BYTES + 32_768);
      cliId = String(form.get("cliId") || "");
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });
      if (/\.docx$/i.test(file.name)) {
        return Response.json({ error: "Word .docx isn't supported yet — export as PDF or Markdown (.md), or paste the text." }, { status: 400 });
      }
      const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".pdf").toLowerCase();
      if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "CV file too large (max 5 MB)" }, { status: 413 });
      const buf = Buffer.from(await file.arrayBuffer());
      if (/\.(md|markdown|txt)$/i.test(file.name)) {
        const text = buf.toString("utf8").trim();
        if (!text) return Response.json({ error: "empty file" }, { status: 400 });
        if (buf.byteLength > MAX_TEXT_BYTES) return Response.json({ error: "CV text too large (max 200 KB)" }, { status: 413 });
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
  } catch (error) {
    if (error instanceof RequestTooLargeError) return Response.json({ error: "CV upload too large (max 5 MB)" }, { status: 413 });
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const resolved = cliId ? resolveCli(cliId) : null;
  const active = resolved ? { cliId } : resolveDefaultCli();
  if (!active) {
    if (extractedText) return localResponse(extractedText);
    return Response.json({ error: "Connect an AI engine in Settings, or paste / drop a .md file." }, { status: 404 });
  }
  const prompt = withPromptSecurityHeader(ingestPrompt(promptSource));
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
        await runAgent({ cliId: active.cliId!, prompt, timeoutMs: 240_000, signal: abort.signal, onEvent: (e) => { if (e.type === "text") enqueue(e.text); } });
        if (!emitted) enqueue('<<cv:error>>{"reason":"no-output"}');
      } catch (error) {
        if (!(error instanceof AgentError && error.status === 499)) enqueue(`\n[error: ${error instanceof Error ? error.message : "AI engine failed"}]`);
        if (!emitted) enqueue('<<cv:error>>{"reason":"no-output"}');
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { abort.abort(); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
