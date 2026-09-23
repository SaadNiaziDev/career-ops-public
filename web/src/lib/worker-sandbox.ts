import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import fs from "node:fs";
import type { Readable } from "node:stream";
import { SandboxManager, type SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

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
};

export type WorkerSpawnOptions = Omit<LaunchOptions, "args"> & {
  args: string[];
  detached?: boolean;
};

const TASK_PHASE: Record<string, WorkerPhase> = {
  research: "fetch",
  discover: "fetch",
  "ai-search": "fetch",
  "form-interpret": "local-analysis",
  "form-prefill": "local-analysis",
  "cv-ingest": "local-analysis",
  "local-analysis": "local-analysis",
  evaluate: "write",
  "fix-portal": "write",
  pdf: "write",
  cover: "write",
  email: "write",
  contacto: "write",
  titles: "write",
  "interview-prep": "write",
  "interview-questions": "write",
  "interview-plan": "write",
  "interview-practice": "write",
  "interview-debrief": "write",
  "interview-redflag": "write",
};

const PROVIDER = {
  claude: { domains: ["api.anthropic.com"], env: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"] },
  codex: { domains: ["api.openai.com", "chatgpt.com"], env: ["OPENAI_API_KEY"] },
} as const;

const COMBINED_FETCH_WRITE_TASKS = new Set(["pdf", "cover", "contacto", "interview-prep", "interview-questions"]);

let initialized: Promise<void> | undefined;

function initializeSandbox(): Promise<void> {
  if (!initialized) {
    initialized = SandboxManager.initialize({
      network: {
        allowedDomains: [...new Set([...PROVIDER.claude.domains, ...PROVIDER.codex.domains])],
        deniedDomains: [],
        allowLocalBinding: false,
      },
      filesystem: { denyRead: [], allowRead: [], allowWrite: [], denyWrite: [] },
    } satisfies SandboxRuntimeConfig).catch((error) => {
      initialized = undefined;
      throw new Error(`Worker OS sandbox initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  return initialized;
}

/** Fail closed until a provider/task combination has an explicit policy. */
export function workerCapabilities(task: string, cliId: string): WorkerCapabilities {
  const phase = TASK_PHASE[task];
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
  const scripts = () => {
    try {
      return fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".mjs")).map((entry) => file(entry.name));
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
          ...read("cv.md", "article-digest.md", "portals.yml", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/oferta.md", "modes/research.md", "templates/states.yml", "data/applications.md", "data/pipeline.md", "data/pdf-index.tsv"),
          file("modes"), file("templates"), ...scripts(),
        ],
        writeRoots: [file("reports"), file("batch/tracker-additions"), file("data/applications.md")],
      };
    case "pdf":
      return { readRoots: [...read("cv.md", "article-digest.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", "modes/pdf.md", "data/pdf-index.tsv", "templates/cv-template.html"), ...matchingReports()], writeRoots: [file("output"), file("data/pdf-index.tsv")] };
    case "cover":
    case "email":
      return { readRoots: [...read("cv.md", "article-digest.md", "config/profile.yml", "modes/_profile.md", "modes/_custom.md", "modes/_shared.md", `modes/${task}.md`, "data/pdf-index.tsv"), ...matchingReports()], writeRoots: [file("data/drafts")] };
    case "contacto":
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
    return [...bounded, "--sandbox", capabilities.readOnly ? "read-only" : "workspace-write", "--ask-for-approval", "never", ...(prompt === undefined ? [] : [prompt])];
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
  let cliRuntimeRoots = [options.binPath];
  try {
    const realBin = fs.realpathSync(options.binPath);
    cliRuntimeRoots = [options.binPath, realBin, path.dirname(realBin)];
  } catch {
    /* An unresolved runtime path stays fail-closed under the OS policy. */
  }
  const readRoots = [...new Set([...options.readRoots, ...cliRuntimeRoots].map((root) => path.resolve(root)))];
  const writeRoots = [...new Set(options.writeRoots.map((root) => path.resolve(root)))];
  const env = allowlistedEnv(cliId, options.env ?? process.env);
  if (!PROVIDER[cliId].env.some((key) => env[key])) {
    throw new Error(`No sandbox-safe credential is available for ${cliId}. Configure a provider API/OAuth token in the server environment; CLI login files are intentionally inaccessible.`);
  }

  await initializeSandbox();
  const command = [options.binPath, ...workerCliArgs(cliId, options.args, capabilities)].map(shellQuote).join(" ");
  const config: Partial<SandboxRuntimeConfig> = {
    filesystem: {
      denyRead: [...new Set([os.homedir(), scopeRoot])],
      allowRead: readRoots,
      allowWrite: writeRoots,
      denyWrite: [],
    },
    credentials: credentialConfig(cliId),
  };
  let wrapped: { argv: string[]; env: NodeJS.ProcessEnv };
  try {
    wrapped = await SandboxManager.wrapWithSandboxArgv(command, "/bin/sh", config, undefined, cwd);
  } catch (error) {
    throw new Error(`Worker sandbox rejected '${options.task}': ${error instanceof Error ? error.message : String(error)}`);
  }
  return { command: wrapped.argv[0]!, args: wrapped.argv.slice(1), cwd, env };
}

export async function spawnSandboxedWorker(options: WorkerSpawnOptions): Promise<ChildProcessByStdio<null, Readable, Readable>> {
  const launch = await buildWorkerLaunch(options);
  return spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: options.detached,
  });
}
