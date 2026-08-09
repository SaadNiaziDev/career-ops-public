import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

// Provider keys live in the repo's .env, the same file the CLIs read. Blueprint
// S13 · redline 3: keys are WRITE-ONLY from the UI — a stored value is never
// returned to the browser, only the fact that one exists and whether it still
// reaches its provider.

export type KeyId = "anthropic" | "gemini" | "openrouter";

export type KeySpec = {
  id: KeyId;
  env: string;
  label: string;
  used: string;
  docs: string;
};

export const KEY_SPECS: KeySpec[] = [
  {
    id: "anthropic",
    env: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    used: "Claude Code workers and AI hunts",
    docs: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    env: "GEMINI_API_KEY",
    label: "Gemini",
    used: "gemini-eval.mjs — free-tier evaluations",
    docs: "https://aistudio.google.com/apikey",
  },
  {
    id: "openrouter",
    env: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    used: "openrouter-runner.mjs — no-CLI fallback",
    docs: "https://openrouter.ai/keys",
  },
];

function envFile(): string {
  return path.join(careerOpsRoot(), ".env");
}

function readEnvText(): string {
  try {
    return fs.readFileSync(envFile(), "utf8");
  } catch {
    return "";
  }
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = value.match(/^(["'])([\s\S]*)\1$/);
    if (quoted) value = quoted[2];
    out[m[1]] = value;
  }
  return out;
}

/** A value that is still the placeholder from .env.example does not count. */
function isPlaceholder(value: string): boolean {
  return !value || /your_.*_here|paste-your-key-here|^\.\.\.$/i.test(value);
}

export type KeyStatus = KeySpec & {
  present: boolean;
  /** Where the value came from — the file wins, the process env is a fallback. */
  origin: "env-file" | "process" | "none";
  length: number;
};

export function readKeyStatuses(): KeyStatus[] {
  const fromFile = parseEnv(readEnvText());
  return KEY_SPECS.map((spec) => {
    const fileValue = fromFile[spec.env] ?? "";
    const procValue = process.env[spec.env]?.trim() ?? "";
    const value = !isPlaceholder(fileValue) ? fileValue : !isPlaceholder(procValue) ? procValue : "";
    const origin: KeyStatus["origin"] = !isPlaceholder(fileValue)
      ? "env-file"
      : !isPlaceholder(procValue)
        ? "process"
        : "none";
    // Only the length escapes — never the characters.
    return { ...spec, present: value.length > 0, origin, length: value.length };
  });
}

/** Server-only read of a stored value, for the reachability probe. */
export function readKeyValue(id: KeyId): string {
  const spec = KEY_SPECS.find((s) => s.id === id);
  if (!spec) return "";
  const fileValue = parseEnv(readEnvText())[spec.env] ?? "";
  if (!isPlaceholder(fileValue)) return fileValue;
  const procValue = process.env[spec.env]?.trim() ?? "";
  return isPlaceholder(procValue) ? "" : procValue;
}

/**
 * Merge-safe upsert of a single key in .env — every other line, comment and
 * blank keeps its position. An empty value removes the assignment.
 */
export function writeKey(id: KeyId, value: string): void {
  const spec = KEY_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`unknown key: ${id}`);
  const trimmed = value.trim();
  const text = readEnvText();
  const lines = text ? text.split("\n") : [];
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${spec.env}\\s*=`);
  const idx = lines.findIndex((l) => pattern.test(l));

  if (!trimmed) {
    if (idx >= 0) lines.splice(idx, 1);
  } else if (idx >= 0) {
    lines[idx] = `${spec.env}=${trimmed}`;
  } else {
    if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    lines.push(`${spec.env}=${trimmed}`);
  }

  const next = lines.join("\n").replace(/\n{3,}$/, "\n");
  atomicWriteWithBackup(envFile(), next.endsWith("\n") ? next : `${next}\n`);
}

/**
 * Live reachability — one cheap authenticated GET per provider. Returns a
 * verdict, never the key. A network failure reads as "unknown", not "invalid":
 * an offline laptop must not look like a bad key.
 */
export async function probeKey(id: KeyId): Promise<{ state: "valid" | "invalid" | "unknown"; detail: string }> {
  const key = readKeyValue(id);
  if (!key) return { state: "unknown", detail: "no key stored" };

  const req: Record<KeyId, { url: string; headers: Record<string, string> }> = {
    anthropic: {
      url: "https://api.anthropic.com/v1/models?limit=1",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    },
    gemini: {
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      headers: { "x-goog-api-key": key },
    },
    openrouter: {
      url: "https://openrouter.ai/api/v1/key",
      headers: { authorization: `Bearer ${key}` },
    },
  };

  const { url, headers } = req[id];
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) return { state: "valid", detail: "reachable" };
    if (res.status === 401 || res.status === 403) return { state: "invalid", detail: `rejected (${res.status})` };
    return { state: "unknown", detail: `provider returned ${res.status}` };
  } catch {
    return { state: "unknown", detail: "no network" };
  }
}
