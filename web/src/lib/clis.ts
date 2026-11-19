import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The AI engines the app can run (see lib/agent.ts for how they are invoked).
export type CliSpec = {
  id: string;
  name: string;
  bin: string;
  /** Alternate binary names (e.g. Cursor ships as `agent` or `cursor-agent`). */
  bins?: string[];
  run: string;
  url: string;
};

export const KNOWN: CliSpec[] = [
  { id: "claude", name: "Claude Code", bin: "claude", run: "claude -p", url: "https://claude.ai/code" },
  { id: "codex", name: "Codex", bin: "codex", run: "codex exec --json", url: "https://github.com/openai/codex" },
];

function searchDirs(): string[] {
  const home = os.homedir();
  const extra = [
    path.join(home, ".local/bin"),
    path.join(home, ".npm-global/bin"),
    path.join(home, ".bun/bin"),
    path.join(home, ".deno/bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
  ];
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    extra.push(
      path.join(localAppData, "Microsoft", "WindowsApps"),
      path.join(appData, "npm"),
    );
  }
  const fromPath = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  return [...new Set([...fromPath, ...extra])];
}

function binCandidates(bin: string): string[] {
  if (process.platform !== "win32") return [bin];
  const pathext = process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD";
  const exts = pathext
    .split(";")
    .map((e) => e.trim())
    .filter(Boolean)
    .filter((e) => [".com", ".exe", ".bat", ".cmd"].includes(e.toLowerCase()));

  return [bin, ...exts.map((ext) => bin + ext)];
}

export function findBin(bin: string, dirs = searchDirs()): string | null {
  for (const dir of dirs) {
    for (const candidate of binCandidates(bin)) {
      const p = path.join(dir, candidate);
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch {
        /* not here */
      }
    }
  }
  return null;
}

function resolveBin(spec: CliSpec, dirs = searchDirs()): string | null {
  for (const name of spec.bins?.length ? spec.bins : [spec.bin]) {
    const found = findBin(name, dirs);
    if (found) return found;
  }
  return null;
}

export function detectClis() {
  const dirs = searchDirs();
  return KNOWN.map((c) => {
    const found = resolveBin(c, dirs);
    return { id: c.id, name: c.name, run: c.run, url: c.url, installed: !!found, path: found };
  });
}

export function resolveCli(id: string): { spec: CliSpec; binPath: string } | null {
  const spec = KNOWN.find((c) => c.id === id);
  if (!spec) return null;
  const binPath = resolveBin(spec);
  if (!binPath) return null;
  return { spec, binPath };
}

/** First installed headless CLI — used when ingest/run has no explicit cliId. */
export function resolveDefaultCli(): { cliId: string; spec: CliSpec; binPath: string } | null {
  for (const c of detectClis()) {
    if (!c.installed) continue;
    const resolved = resolveCli(c.id);
    if (resolved) return { cliId: c.id, ...resolved };
  }
  return null;
}
