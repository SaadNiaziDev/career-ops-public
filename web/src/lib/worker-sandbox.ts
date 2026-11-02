import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import fs from "node:fs";
import type { Readable } from "node:stream";
import { SandboxManager, type SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import { acquireWorkerSlot } from "./core/worker-admission.ts";
import { getRunTaskPolicy } from "./jobs/run-task-registry.ts";

export type WorkerPhase = "fetch" | "local-analysis" | "write";
export type WorkerCapabilities = {
  phase: WorkerPhase;
  readOnly: boolean;
  externalFetch: boolean;
  shell: boolean;
};

type LaunchOptions = {
  cliId: string;
  task: string;
  binPath: string;
  args: string[];
  cwd: string;
  scopeRoot: string;
  readRoots: string[];
  writeRoots: string[];
  env?: NodeJS.ProcessEnv;
};

export type WorkerLaunch = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Removes per-launch scratch space; call once the worker has exited. */
  cleanup: () => void;
};

export type WorkerSpawnOptions = Omit<LaunchOptions, "args"> & {
  args: string[];
  detached?: boolean;
  clientId?: string;
  signal?: AbortSignal;
};

export class WorkerCapacityError extends Error {
  readonly reason: "client-limit" | "queue-full" | "cancelled";
  constructor(reason: "client-limit" | "queue-full" | "cancelled") {
    super(reason === "cancelled" ? "Worker request was cancelled while queued." : "Worker capacity is full for this client or server. Wait for a running task to finish, then retry.");
    this.name = "WorkerCapacityError";
    this.reason = reason;
  }
}

export function terminateWorkerProcess(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") process.kill(pid, signal);
    else process.kill(-pid, signal);
  } catch {
    try { process.kill(pid, signal); } catch { /* process already stopped */ }
  }
}

const TASK_PHASE: Record<string, WorkerPhase> = {
  research: "fetch",
  discover: "fetch",
  "ai-search": "fetch",
  "contacto-research": "fetch",
  "form-interpret": "local-analysis",
  "form-prefill": "local-analysis",
  "cv-ingest": "local-analysis",
  "local-analysis": "local-analysis",
  "contacto-write": "write",
};

const PROVIDER = {
  claude: { domains: ["api.anthropic.com"], env: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"] },
  codex: { domains: ["api.openai.com", "chatgpt.com"], env: ["OPENAI_API_KEY", "CODEX_ACCESS_TOKEN"] },
} as const;

const COMBINED_FETCH_WRITE_TASKS = new Set(["cover", "contacto", "interview-prep", "interview-questions"]);

let initialized: Promise<void> | undefined;

function initializeSandbox(): Promise<void> {
  if (!initialized) {
    initialized = SandboxManager.initialize({
      network: {
        allowedDomains: [...new Set([...PROVIDER.claude.domains, ...PROVIDER.codex.domains])],
        deniedDomains: [],
        allowLocalBinding: false,
        // Masked credentials are only swapped back on egress when the proxy
        // terminates TLS; an opaque CONNECT tunnel forwards the sentinel and
        // the provider answers 401 "Invalid bearer token".
        tlsTerminate: {},
      },
      filesystem: { denyRead: [], allowRead: [], allowWrite: [], denyWrite: [] },
      // The proxy only installs its sentinel→real injector when a global
      // credentials block exists; per-launch masks (credentialConfig) then
      // register their sentinels against it.
      credentials: { envVars: [] },
    } satisfies SandboxRuntimeConfig).catch((error) => {
      initialized = undefined;
      throw new Error(`Worker OS sandbox initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  return initialized;
}

/** Fail closed until a provider/task combination has an explicit policy. */
export function workerCapabilities(task: string, cliId: string): WorkerCapabilities {
  const phase = getRunTaskPolicy(task)?.workerPhase ?? TASK_PHASE[task];
  if (!phase || !(cliId in PROVIDER)) {
    throw new Error(`Worker task '${task}' with CLI '${cliId}' is not supported by the security profile.`);
  }
  if (process.platform === "win32") {
    throw new Error("Per-task filesystem grants are not supported by the Windows worker sandbox yet; refusing to launch unsandboxed.");
  }
  if (COMBINED_FETCH_WRITE_TASKS.has(task)) {
    throw new Error(`Worker task '${task}' needs web research and local writes in separate phases; refusing to run it until that workflow is split.`);
  }
  if (phase === "fetch") return { phase, readOnly: true, externalFetch: true, shell: false };
  if (phase === "local-analysis") return { phase, readOnly: true, externalFetch: false, shell: false };
  return { phase, readOnly: false, externalFetch: false, shell: true };
}

/** Return only files/directories a task needs; the home directory remains denied. */
export function workerRoots(task: string, root: string, target?: string): { readRoots: string[]; writeRoots: string[] } {
  const base = path.resolve(root);
  const file = (...parts: string[]) => path.join(base, ...parts);
  const matchingReports = () => {
    if (!target) return [];
    try {
      return fs.readdirSync(file("reports"))
        .filter((name) => name.endsWith(".md"))
        .filter((name) => {
          if (/^\d+$/.test(target)) return Number.parseInt(name, 10) === Number.parseInt(target, 10);
          try { return fs.readFileSync(file("reports", name), "utf8").toLowerCase().includes(target.toLowerCase()); }
          catch { return false; }
        })
        .map((name) => file("reports", name));
    } catch {
      return [];
    }
  };
  // Root scripts plus what they load at import time: tracker-parse.mjs reads
  // tracker-aliases.json, and js-yaml is their only third-party import.
  const scripts = () => {
    try {
      return [
        ...fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".mjs")).map((entry) => file(entry.name)),
        file("tracker-aliases.json"),
        file("node_modules/js-yaml"),
      ];
    } catch {
      return [];
    }
  };
  const read = (...paths: string[]) => paths.map((rel) => file(rel));
  switch (task) {
    case "research":
    case "discover":
    case "ai-search":
    case "form-interpret":
    case "cv-ingest":
    case "local-analysis":
      return { readRoots: [], writeRoots: [] };
    case "form-prefill":
      return { readRoots: [...read("cv.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md"), ...matchingReports()], writeRoots: [] };
    case "evaluate":
      return {
        readRoots: [
          ...read("cv.md", "article-digest.md", "portals.yml", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/oferta.md", "modes/research.md", "templates/states.yml", "batch/batch-prompt.md", "data/applications.md", "data/pipeline.md", "data/pdf-index.tsv"),
          file("modes"), file("templates"), ...scripts(),
        ],
        // merge-tracker replaces applications.md atomically: a dot-prefixed temp
        // sibling renamed over it, after the same for applications.md.bak.
        writeRoots: [file("reports"), file("batch/tracker-additions"), file("data/applications.md"), file("data/applications.md.bak"), file("data/.applications.md.*")],
      };
    case "pdf":
      return { readRoots: [...read("cv.md", "article-digest.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/pdf.md", "data/pdf-index.tsv", "templates/cv-template.html"), ...matchingReports()], writeRoots: [file("output"), file("data/pdf-index.tsv")] };
    case "cover":
    case "email":
      return { readRoots: [...read("cv.md", "article-digest.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", `modes/${task}.md`, "data/pdf-index.tsv"), ...matchingReports()], writeRoots: [file("data/drafts")] };
    case "contacto-research":
      return { readRoots: [...read("cv.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/contacto.md"), ...matchingReports()], writeRoots: [] };
    case "contacto":
    case "contacto-write":
      return { readRoots: [...read("cv.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/contacto.md"), ...matchingReports()], writeRoots: [file("data/drafts"), file("data/contacts.tsv")] };
    case "titles":
      return { readRoots: [...read("cv.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/titles.md", "portals.yml")], writeRoots: [file("data/titles-suggestions.json")] };
    case "interview-prep":
    case "interview-questions":
    case "interview-plan":
    case "interview-practice":
    case "interview-debrief":
    case "interview-redflag":
      return { readRoots: [...read("cv.md", "article-digest.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "interview-prep/story-bank.md", "interview-prep/question-bank.md"), file("modes"), ...matchingReports(), ...scripts()], writeRoots: [file("interview-prep")] };
    case "fix-portal":
      throw new Error("Portal repair would write user-layer portals.yml; this task is not authorized for worker writes.");
    default:
      throw new Error(`Worker task '${task}' is not configured with purpose-specific file roots.`);
  }
}

function allowlistedEnv(cliId: keyof typeof PROVIDER, input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = {} as NodeJS.ProcessEnv;
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "TERM", "NO_COLOR", ...PROVIDER[cliId].env]) {
    const value = input[key];
    if (value === undefined) continue;
    const credentialNames: readonly string[] = PROVIDER[cliId].env;
    if (credentialNames.includes(key) && value !== process.env[key]) continue;
    out[key] = value;
  }
  return out;
}

function codexLoginAuth(): string | undefined {
  try {
    const contents = fs.readFileSync(path.join(os.homedir(), ".codex", "auth.json"), "utf8");
    const auth = JSON.parse(contents) as { tokens?: { access_token?: unknown } };
    return typeof auth.tokens?.access_token === "string" ? contents : undefined;
  } catch {
    return undefined;
  }
}

/** Bun-based CLIs (Claude Code) call getcwd() at boot, which macOS implements by
 * opening "." for reading; the scope-root deny blocks that and the CLI exits with
 * "An unknown error occurred (Unexpected)". A bracket glob compiles to an
 * exact-match Seatbelt regex, so only the directory itself becomes readable —
 * files beneath it stay denied unless granted separately. */
function exactDirectoryReadRoot(dir: string): string | undefined {
  if (process.platform !== "darwin" || /[*?[\]{}]/.test(dir)) return undefined;
  return `${dir.slice(0, -1)}[${dir.at(-1)}]`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

const SAFE_CLAUDE_TOOLS = {
  fetch: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
  "local-analysis": ["Read", "Glob", "Grep"],
  write: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
} satisfies Record<WorkerPhase, string[]>;

const DENIED_CLAUDE_TOOLS = {
  fetch: ["Bash", "Write", "Edit", "NotebookEdit", "Task", "Agent"],
  "local-analysis": ["Bash", "Write", "Edit", "NotebookEdit", "Task", "Agent", "WebFetch", "WebSearch"],
  write: ["NotebookEdit", "Task", "Agent", "WebFetch", "WebSearch"],
} satisfies Record<WorkerPhase, string[]>;

function setOption(args: string[], flag: string, value: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === flag) {
      index++;
      continue;
    }
    if (arg.startsWith(`${flag}=`)) continue;
    out.push(arg);
  }
  return [...out, flag, value];
}

export function workerCliArgs(cliId: string, args: string[], capabilities: WorkerCapabilities): string[] {
  if (cliId === "claude") {
    const safe = SAFE_CLAUDE_TOOLS[capabilities.phase];
    const allowedAt = args.indexOf("--allowedTools");
    const requested = allowedAt >= 0 ? (args[allowedAt + 1] ?? "").split(",").filter(Boolean) : safe;
    const allowed = requested.filter((tool) => safe.includes(tool));
    const disallowedAt = args.indexOf("--disallowedTools");
    const existingDenied = disallowedAt >= 0 ? (args[disallowedAt + 1] ?? "").split(",").filter(Boolean) : [];
    const denied = [...new Set([...existingDenied, ...DENIED_CLAUDE_TOOLS[capabilities.phase]])];
    return setOption(setOption(args, "--allowedTools", allowed.join(",")), "--disallowedTools", denied.join(","));
  }

  if (cliId === "codex") {
    const bounded: string[] = [];
    for (let index = 0; index < args.length; index++) {
      const arg = args[index]!;
      if (arg === "--sandbox" || arg === "--ask-for-approval") {
        index++;
        continue;
      }
      if (arg.startsWith("--sandbox=") || arg.startsWith("--ask-for-approval=")) continue;
      bounded.push(arg);
    }
    const prompt = bounded.pop();
    return [
      ...bounded,
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--sandbox",
      capabilities.readOnly ? "read-only" : "workspace-write",
      ...(prompt === undefined ? [] : [prompt]),
    ];
  }
  throw new Error(`CLI '${cliId}' has no enforceable worker capability profile.`);
}

function credentialConfig(cliId: keyof typeof PROVIDER): SandboxRuntimeConfig["credentials"] {
  const hosts: string[] = [...PROVIDER[cliId].domains];
  return {
    envVars: PROVIDER[cliId].env.map((name) => ({
      name,
      mode: "mask" as const,
      onExtractNoMatch: "error" as const,
      injectHosts: hosts,
    })),
  };
}

/** Wrap a CLI command with OS filesystem/network isolation and scoped permissions. */
export async function buildWorkerLaunch(options: LaunchOptions): Promise<WorkerLaunch> {
  const capabilities = workerCapabilities(options.task, options.cliId);
  const cliId = options.cliId as keyof typeof PROVIDER;
  const cwd = path.resolve(options.cwd);
  const scopeRoot = path.resolve(options.scopeRoot);
  const env = allowlistedEnv(cliId, options.env ?? process.env);
  if (cliId === "codex") {
    if (!env.OPENAI_API_KEY && !env.CODEX_ACCESS_TOKEN && !codexLoginAuth()) {
      throw new Error("No Codex credential is available. Run `codex login`, then retry.");
    }
    return {
      command: options.binPath,
      args: workerCliArgs(cliId, options.args, capabilities),
      cwd,
      env,
      cleanup: () => {},
    };
  }
  let cliRuntimeRoots = [options.binPath];
  try {
    const realBin = fs.realpathSync(options.binPath);
    cliRuntimeRoots = [options.binPath, realBin, path.dirname(realBin)];
  } catch {
    /* An unresolved runtime path stays fail-closed under the OS policy. */
  }
  let realCwd = cwd;
  try {
    realCwd = fs.realpathSync(cwd);
  } catch {
    /* A missing cwd fails at spawn; keep the resolved spelling. */
  }
  const cwdReadRoot = exactDirectoryReadRoot(realCwd);
  const readRoots = [...new Set([...options.readRoots, ...cliRuntimeRoots].map((root) => path.resolve(root)))];
  if (cwdReadRoot) readRoots.push(cwdReadRoot);
  const writeRoots = [...new Set(options.writeRoots.map((root) => path.resolve(root)))];
  if (!PROVIDER[cliId].env.some((key) => env[key])) {
    throw new Error(`No sandbox-safe credential is available for ${cliId}. Configure a provider API/OAuth token in the server environment; CLI login files are intentionally inaccessible.`);
  }

  await initializeSandbox();
  // Claude Code's Bash tool keeps per-session state under
  // $CLAUDE_CODE_TMPDIR/claude-<uid>/ (default /tmp), which the OS policy does
  // not grant, so every command failed with EPERM mkdir. A private per-launch
  // directory keeps Bash working without sharing scratch space between workers.
  const hostTmp = fs.realpathSync(os.tmpdir());
  const scratch = fs.mkdtempSync(path.join(hostTmp, "career-ops-worker-"));
  const cleanup = () => fs.rmSync(scratch, { recursive: true, force: true });
  env.CLAUDE_CODE_TMPDIR = scratch;
  // The sandbox points TMPDIR at /tmp/claude, which does not exist, so
  // os.tmpdir() consumers crash. Tracker scripts serialize on a lock under
  // os.tmpdir(); the host temp root shares that lock with the server, the
  // CLI and parallel workers, and only tracker writers may create it.
  const writesTracker = writeRoots.includes(path.join(scopeRoot, "data", "applications.md"));
  const trackerLocks = writesTracker ? [path.join(hostTmp, "career-ops-merge-tracker-**")] : [];
  const command = `TMPDIR=${shellQuote(hostTmp)} ${[options.binPath, ...workerCliArgs(cliId, options.args, capabilities)].map(shellQuote).join(" ")}`;
  const config: Partial<SandboxRuntimeConfig> = {
    filesystem: {
      denyRead: [...new Set([os.homedir(), scopeRoot])],
      // A write grant without read leaves scripts unable to list what they
      // update (reserve-report-num scans reports/, merge-tracker its inbox).
      allowRead: [...new Set([...readRoots, ...writeRoots])],
      allowWrite: [...writeRoots, scratch, ...trackerLocks],
      denyWrite: [],
    },
    credentials: credentialConfig(cliId),
  };
  let wrapped: { argv: string[]; env: NodeJS.ProcessEnv };
  try {
    wrapped = await SandboxManager.wrapWithSandboxArgv(command, "/bin/sh", config, undefined, cwd);
  } catch (error) {
    cleanup();
    throw new Error(`Worker sandbox rejected '${options.task}': ${error instanceof Error ? error.message : String(error)}`);
  }
  return { command: wrapped.argv[0]!, args: wrapped.argv.slice(1), cwd, env, cleanup };
}

export async function spawnSandboxedWorker(options: WorkerSpawnOptions): Promise<ChildProcessByStdio<null, Readable, Readable>> {
  const admission = await acquireWorkerSlot(options.clientId || "local", { signal: options.signal });
  if (!admission.accepted) throw new WorkerCapacityError(admission.reason);
  try {
    if (options.signal?.aborted) throw new WorkerCapacityError("cancelled");
    const launch = await buildWorkerLaunch(options);
    if (options.signal?.aborted) {
      launch.cleanup();
      throw new WorkerCapacityError("cancelled");
    }
    const child = spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      env: launch.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: options.detached,
    });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      launch.cleanup();
      admission.release();
    };
    child.once("close", finish);
    child.once("error", finish);
    return child;
  } catch (error) {
    admission.release();
    throw error;
  }
}
