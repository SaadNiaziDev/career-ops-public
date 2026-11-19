import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { resolveCli } from "./clis.ts";

// The one way the app runs AI. Claude Code or Codex runs headless on the user's
// own subscription login, in an empty temp folder, with no file, shell or MCP
// tools: everything the agent needs is in the prompt, and it answers with JSON.
// Only tasks that need the internet (search, finding a hiring contact) get web
// search/fetch. The server validates the JSON and does every write itself.

export type AgentEvent =
  | { type: "status"; label: string }
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  | { type: "usage"; tokens: number; costUsd?: number };

export type AgentOptions = {
  cliId: string;
  prompt: string;
  /** Allow web search + page fetch (no local tools either way). */
  web?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
};

export type AgentResult = { text: string; tokens: number; costUsd?: number };

export class AgentError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AgentError";
    this.status = status;
  }
}

export const SUPPORTED_CLIS = ["claude", "codex"] as const;
const MAX_PROMPT_BYTES = 400_000;
const MAX_CONCURRENT = 3;
const SUBSCRIPTION_OVERRIDES = [
  "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CODEX_ACCESS_TOKEN",
  "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION",
];

// ── Concurrency: at most MAX_CONCURRENT agents at once, the rest wait in order. ──
let running = 0;
const waiting: (() => void)[] = [];
async function acquireSlot(signal?: AbortSignal): Promise<() => void> {
  if (running >= MAX_CONCURRENT) {
    await new Promise<void>((resolve, reject) => {
      const go = () => { signal?.removeEventListener("abort", onAbort); resolve(); };
      const onAbort = () => {
        const i = waiting.indexOf(go);
        if (i >= 0) waiting.splice(i, 1);
        reject(new AgentError("Cancelled while waiting for a free worker.", 499));
      };
      waiting.push(go);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  running += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    running -= 1;
    waiting.shift()?.();
  };
}

export function agentArgs(cliId: string, prompt: string, web = false): string[] {
  if (cliId === "claude") {
    return [
      "-p", prompt,
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--tools", web ? "WebSearch,WebFetch" : "",
      ...(web ? ["--allowedTools", "WebSearch,WebFetch"] : []),
      "--restricted", "--strict-mcp-config",
      "--permission-mode", "dontAsk",
    ];
  }
  if (cliId === "codex") {
    return [
      "exec", "--json", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules",
      "--sandbox", "read-only",
      ...(web ? ["--search"] : []),
      prompt,
    ];
  }
  throw new AgentError(`Unsupported AI engine '${cliId}'. Pick Claude Code or Codex in Settings.`, 400);
}

function killTree(pid: number | undefined, signal: NodeJS.Signals) {
  if (!pid) return;
  try { process.kill(-pid, signal); } catch { try { process.kill(pid, signal); } catch { /* already gone */ } }
}

/** Turn one line of CLI JSON output into app events; returns final text / errors via the sink. */
function parseLine(cliId: string, line: string, sink: { emit: (e: AgentEvent) => void; text: (t: string) => void; final: (t: string) => void; error: (m: string) => void }) {
  let ev: Record<string, any>;
  try { ev = JSON.parse(line); } catch { return; }
  if (cliId === "claude") {
    if (ev.type === "system" && ev.subtype === "init") sink.emit({ type: "status", label: "Agent ready" });
    else if (ev.type === "stream_event") {
      const inner = ev.event;
      if (inner?.type === "content_block_start" && inner.content_block?.type === "tool_use") sink.emit({ type: "tool", name: inner.content_block.name });
      else if (inner?.type === "content_block_delta" && typeof inner.delta?.text === "string") sink.text(inner.delta.text);
    } else if (ev.type === "result") {
      const u = ev.usage ?? {};
      sink.emit({ type: "usage", tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), costUsd: typeof ev.total_cost_usd === "number" ? ev.total_cost_usd : undefined });
      if (ev.is_error) sink.error(typeof ev.result === "string" && ev.result ? ev.result : "Claude Code reported an error.");
      else if (typeof ev.result === "string") sink.final(ev.result);
    }
    return;
  }
  if (ev.type === "item.started" && ev.item?.type === "web_search") sink.emit({ type: "tool", name: "WebSearch" });
  else if (ev.type === "item.completed" && ev.item?.type === "agent_message" && typeof ev.item.text === "string") {
    sink.text(ev.item.text);
    sink.final(ev.item.text);
  } else if (ev.type === "turn.completed") {
    const u = ev.usage ?? {};
    sink.emit({ type: "usage", tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) });
  } else if (ev.type === "error" && typeof ev.message === "string") sink.error(ev.message);
  else if (ev.type === "turn.failed") sink.error(ev.error?.message ?? "Codex stopped with an error.");
}

/** Run one agent task to completion and return its final message. */
export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  if (!(SUPPORTED_CLIS as readonly string[]).includes(opts.cliId)) agentArgs(opts.cliId, "");
  if (Buffer.byteLength(opts.prompt, "utf8") > MAX_PROMPT_BYTES) throw new AgentError("The request is too large for one AI run.", 413);
  const resolved = resolveCli(opts.cliId);
  if (!resolved) throw new AgentError(`${opts.cliId === "claude" ? "Claude Code" : "Codex"} is not installed or not on PATH.`, 404);
  if (opts.signal?.aborted) throw new AgentError("Cancelled.", 499);

  const release = await acquireSlot(opts.signal);
  // Subscription login only: a stale token or API key in the environment (e.g. an
  // old web/.env.local) would override the CLI's own sign-in, so strip them.
  const env = { ...process.env };
  for (const key of SUBSCRIPTION_OVERRIDES) delete env[key];
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-agent-"));
  let child: ChildProcessByStdio<null, Readable, Readable>;
  try {
    child = spawn(resolved.binPath, agentArgs(opts.cliId, opts.prompt, opts.web), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
  } catch (error) {
    release();
    fs.rmSync(cwd, { recursive: true, force: true });
    throw new AgentError(error instanceof Error ? error.message : "Could not start the AI engine.", 503);
  }

  return new Promise<AgentResult>((resolve, reject) => {
    let buffer = "";
    let streamed = "";
    let final = "";
    let failure = "";
    let stderr = "";
    let tokens = 0;
    let costUsd: number | undefined;
    let timedOut = false;
    let cancelled = false;
    const emit = (e: AgentEvent) => {
      if (e.type === "usage") { tokens = e.tokens; costUsd = e.costUsd ?? costUsd; }
      opts.onEvent?.(e);
    };
    const sink = {
      emit,
      text: (t: string) => { streamed = (streamed + t).slice(-200_000); opts.onEvent?.({ type: "text", text: t }); },
      final: (t: string) => { final = t; },
      error: (m: string) => { failure = m; },
    };
    const stop = () => {
      killTree(child.pid, "SIGTERM");
      setTimeout(() => killTree(child.pid, "SIGKILL"), 3_000).unref();
    };
    const onAbort = () => { cancelled = true; stop(); };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop(); }, opts.timeoutMs ?? 600_000);

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) parseLine(opts.cliId, line, sink);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-4_000); });
    const finish = (code: number | null) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      if (buffer.trim()) parseLine(opts.cliId, buffer.trim(), sink);
      release();
      fs.rmSync(cwd, { recursive: true, force: true });
      const text = final || streamed;
      if (cancelled) return reject(new AgentError("Cancelled.", 499));
      if (timedOut) return reject(new AgentError("The AI engine took too long and was stopped.", 504));
      if (failure) return reject(new AgentError(failure));
      if (code !== 0 && !text.trim()) return reject(new AgentError(stderr.trim().split("\n").at(-1) || `The AI engine exited with code ${code}.`));
      if (!text.trim()) return reject(new AgentError("The AI engine finished without an answer."));
      resolve({ text, tokens, costUsd });
    };
    child.once("error", (error) => { failure = error.message; });
    child.once("close", finish);
  });
}

/** Parse the last ```json fence (or the last top-level {...}) from an agent answer. */
export function extractJson<T = unknown>(text: string): T {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim()).filter((s) => s.startsWith("{") || s.startsWith("["));
  const candidates = fences.length ? fences.reverse() : [];
  if (!candidates.length) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  }
  for (const c of candidates) {
    try { return JSON.parse(c) as T; } catch { /* try the next one */ }
  }
  throw new AgentError("The AI answer did not contain valid JSON.");
}
