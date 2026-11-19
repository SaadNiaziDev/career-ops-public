import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { careerOpsRoot, engineScript, readApplications, readReport } from "@/lib/career-ops";
import { acquireRun, attachRunCancellation, cancelRun, releaseRun } from "@/lib/core/run-registry";
import { readBoundedJson, RequestTooLargeError } from "@/lib/core/request-bounds";
import { intentKey } from "@/lib/jobs/run-policy";
import { AgentError, extractJson, runAgent, type AgentEvent } from "@/lib/agent";
import { candidateContext, hasCv } from "@/lib/agent-context";
import { coverLetterPrompt, evaluatePrompt, outreachPrompt, tailorCvPrompt } from "@/lib/prompts";
import { evaluationForUrl, saveEvaluation, validateEvaluation } from "@/lib/evaluations";
import { draftPath } from "@/lib/contacts";
import { cleanCvPayload } from "@/lib/cv/clean-payload";
import { atomicWrite } from "@/lib/core/safe-write";
import { parseOutreachOutput, saveOutreach } from "@/lib/outreach";
import { validatePublicUrl } from "@/lib/public-url-policy";
import { fetchPostingContent } from "@/lib/posting-content";
import { untrustedContent } from "@/lib/untrusted-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

// Runs one AI task and streams NDJSON progress: status / tool / text / done / error / cancelled.
// The agent only returns JSON; this route validates it and saves the result.

type Kind = "evaluate" | "pdf" | "cover" | "outreach";
const KINDS: Record<Kind, { web: boolean; timeoutMs: number; start: string }> = {
  evaluate: { web: false, timeoutMs: 600_000, start: "Reading the posting" },
  pdf: { web: false, timeoutMs: 600_000, start: "Tailoring your CV" },
  cover: { web: false, timeoutMs: 300_000, start: "Writing the cover letter" },
  outreach: { web: true, timeoutMs: 480_000, start: "Researching who's hiring" },
};

type Context = { postingText?: string; tone?: string; avoidContacts?: string[] };
type Send = (event: Record<string, unknown>) => void;
type Outcome = { text: string; reportN?: string; extra?: Record<string, unknown> };

const today = () => new Date().toISOString().slice(0, 10);
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";

function ndjson(events: Record<string, unknown>[]): Response {
  return new Response(events.map((e) => JSON.stringify(e)).join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}

function reportFor(n: string): string {
  const report = readReport(n);
  if (!report) throw new AgentError(`No evaluation found for #${n}. Evaluate the role first.`, 404);
  return `--- EVALUATION REPORT #${n} ---\n${untrustedContent("evaluation report", report.content.slice(0, 40_000))}`;
}

async function postingFor(url: string, context?: Context): Promise<{ block: string; verification: string }> {
  await validatePublicUrl(url);
  const pasted = context?.postingText;
  if (pasted !== undefined) {
    if (typeof pasted !== "string" || pasted.trim().length < 300 || pasted.length > 40_000) throw new AgentError("Paste a job description between 300 and 40,000 characters.", 422);
    return { block: untrustedContent("job posting (pasted by the user)", pasted.trim()), verification: "job description pasted by you; posting liveness unconfirmed" };
  }
  const fetched = await fetchPostingContent(url);
  return { block: untrustedContent("job posting", fetched), verification: "posting fetched by the app" };
}

async function evaluate(input: string, cliId: string, context: Context | undefined, signal: AbortSignal, onEvent: (e: AgentEvent) => void, send: Send): Promise<Outcome> {
  const url = input.trim();
  let posting;
  try { posting = await postingFor(url, context); }
  catch (error) { throw new AgentError(error instanceof Error ? error.message : "The posting could not be fetched. Paste the job description instead.", 422); }
  send({ type: "status", label: "Scoring the role against your profile" });
  const { text } = await runAgent({ cliId, prompt: evaluatePrompt({ url, posting: posting.block, candidate: candidateContext(), today: today() }), timeoutMs: KINDS.evaluate.timeoutMs, signal, onEvent });
  send({ type: "status", label: "Saving the evaluation" });
  const result = validateEvaluation(extractJson(text));
  const n = saveEvaluation(result, url, posting.verification);
  return { text: `#${n} ${result.company} — ${result.role}: ${result.score.toFixed(1)}/5${result.final_decision ? ` · ${result.final_decision}` : ""}`, reportN: n };
}

function renderCv(n: string, payload: unknown): string {
  const root = careerOpsRoot();
  const { payload: clean, problems } = cleanCvPayload(payload);
  if (problems.length) throw new AgentError(`The tailored CV came back incomplete (${problems.join(", ")}). Retry.`);
  const p = clean as { candidate?: { name?: string } };
  const company = readApplications().find((a) => a.n === n)?.company ?? "role";
  const dir = path.join(root, "output", ".cv");
  fs.mkdirSync(dir, { recursive: true });
  const base = `cv-${slug(p.candidate?.name ?? "candidate")}-${slug(company)}`;
  const file = path.join(dir, `${base}.json`);
  atomicWrite(file, JSON.stringify(clean, null, 2));
  const rendered = spawnSync(process.execPath, [engineScript("render-cv"), file, path.join(dir, `${base}.html`), path.join(dir, `${base}-${today()}.pdf`), `--report=${n}`], { cwd: root, encoding: "utf8", timeout: 120_000 });
  if (rendered.status !== 0) throw new AgentError((rendered.stderr || rendered.stdout || "The CV renderer failed.").trim().split("\n").slice(-3).join(" "));
  return `${base}-${today()}.pdf`;
}

async function run(kind: Kind, input: string, cliId: string, context: Context | undefined, signal: AbortSignal, send: Send): Promise<Outcome> {
  let chars = 0;
  let lastProgress = 0;
  const onEvent = (e: AgentEvent) => {
    if (e.type === "text") {
      chars += e.text.length;
      if (Date.now() - lastProgress > 3_000) {
        lastProgress = Date.now();
        send({ type: "status", label: `Writing… ${Math.round(chars / 6)} words` });
      }
    } else if (e.type === "tool") send({ type: "tool", name: e.name });
    else if (e.type === "status") send({ type: "status", label: e.label });
    else if (e.type === "usage") send({ type: "usage", tokens: e.tokens, costUsd: e.costUsd });
  };
  if (kind === "evaluate") return evaluate(input, cliId, context, signal, onEvent, send);

  if (kind === "outreach") {
    const numeric = /^\d+$/.test(input.trim());
    let posting = "";
    if (!numeric) {
      try { await validatePublicUrl(input); posting = `\n--- JOB POSTING ---\n${untrustedContent("job posting", await fetchPostingContent(input))}`; }
      catch { posting = ""; }
    }
    const prompt = outreachPrompt({
      target: numeric ? `application #${input}` : untrustedContent("job link", input),
      report: numeric ? reportFor(input) : "",
      posting,
      candidate: candidateContext({ voice: true }),
      today: today(),
      tone: ["polite", "confident", "spicy"].includes(String(context?.tone)) ? String(context?.tone) : "",
      avoid: Array.isArray(context?.avoidContacts) ? context.avoidContacts.map(String) : [],
    });
    const { text } = await runAgent({ cliId, prompt, web: true, timeoutMs: KINDS.outreach.timeoutMs, signal, onEvent });
    const parsed = parseOutreachOutput(text, { trackerNum: numeric ? input : undefined, jobUrl: numeric ? undefined : input, tone: context?.tone });
    if ("error" in parsed) throw new AgentError(parsed.error);
    saveOutreach(parsed);
    return { text: `Email ready for ${parsed.contact.name} at ${parsed.company}.`, extra: { outreachId: parsed.id } };
  }

  if (!/^\d+$/.test(input.trim())) throw new AgentError("Pick an evaluated application first.", 400);
  const n = input.trim();
  const report = reportFor(n);
  if (kind === "pdf") {
    const { text } = await runAgent({ cliId, prompt: tailorCvPrompt({ report, candidate: candidateContext(), today: today() }), timeoutMs: KINDS.pdf.timeoutMs, signal, onEvent });
    send({ type: "status", label: "Rendering the PDF" });
    const pdf = renderCv(n, extractJson(text));
    return { text: `Tailored CV ready: ${pdf}`, reportN: n };
  }
  const { text } = await runAgent({ cliId, prompt: coverLetterPrompt({ report, candidate: candidateContext({ voice: true }), today: today() }), timeoutMs: KINDS.cover.timeoutMs, signal, onEvent });
  const letter = String(extractJson<{ coverLetter?: unknown }>(text).coverLetter ?? "").trim();
  if (letter.length < 200) throw new AgentError("The cover letter came back empty. Retry.");
  atomicWrite(draftPath(n, "cover"), `${letter}\n`);
  return { text: "Cover letter saved.", reportN: n };
}

export async function DELETE(req: Request) {
  const runId = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^job-[a-z0-9-]+$/i.test(runId)) return Response.json({ error: "valid run id required" }, { status: 400 });
  return cancelRun(runId) ? Response.json({ ok: true }) : Response.json({ error: "run is no longer active" }, { status: 404 });
}

export async function POST(req: Request) {
  let body: { kind?: string; input?: string; cliId?: string; runId?: string; context?: Context };
  try { body = await readBoundedJson(req, 256_000); }
  catch (error) { return Response.json({ error: error instanceof RequestTooLargeError ? "Request too large." : "bad json" }, { status: error instanceof RequestTooLargeError ? 413 : 400 }); }
  const { kind = "evaluate", input, cliId, runId, context } = body;
  if (!Object.hasOwn(KINDS, kind)) return Response.json({ error: `Unsupported task '${kind}'.` }, { status: 400 });
  if (typeof input !== "string" || !input.trim() || input.length > 8_000 || !cliId || !runId || !/^job-[a-z0-9-]+$/i.test(runId)) {
    return Response.json({ error: "input, cliId and a valid runId are required" }, { status: 400 });
  }
  if (!hasCv()) return Response.json({ error: "Add your CV first (Brain → CV) so results are about you." }, { status: 400 });

  if (kind === "evaluate") {
    const existing = evaluationForUrl(input);
    if (existing) return ndjson([{ type: "status", label: `Already evaluated as #${existing}` }, { type: "text", text: `Already evaluated as #${existing}.` }, { type: "done", reportN: existing }]);
  }
  const registration = acquireRun(runId, intentKey(kind, input));
  if (!registration.accepted) return Response.json({ error: "This task is already running.", existingRunId: registration.existingRunId }, { status: 409 });

  const abort = new AbortController();
  attachRunCancellation(runId, () => abort.abort());
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: Send = (event) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(`${JSON.stringify(event)}\n`)); } catch { closed = true; }
      };
      let tokens = 0;
      let costUsd: number | undefined;
      send({ type: "status", label: KINDS[kind as Kind].start });
      try {
        const outcome = await run(kind as Kind, input.trim(), cliId, context, abort.signal, (e) => {
          if (e.type === "usage") { tokens = Number(e.tokens) || 0; costUsd = e.costUsd as number | undefined; return; }
          send(e);
        });
        send({ type: "text", text: outcome.text });
        if (outcome.extra?.outreachId) send({ type: "outreach", id: outcome.extra.outreachId });
        send({ type: "done", reportN: outcome.reportN, tokens, costUsd });
      } catch (error) {
        if (error instanceof AgentError && error.status === 499) send({ type: "cancelled", msg: "Cancelled safely" });
        else send({ type: "error", msg: error instanceof Error ? error.message : "The task failed." });
      } finally {
        releaseRun(runId);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
