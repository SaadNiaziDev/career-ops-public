"use client";

export const CONFIG_KEY = "career-ops:config";

export type CliConfig = {
  cliId: string | null;
  mode?: string;
  provider?: string;
  logos?: boolean;
  runTimeout?: number;
  maxWorkers?: number;
};

const CLI_NAMES: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

export function readCliConfig(): CliConfig {
  if (typeof window === "undefined") return { cliId: null };
  try {
    const v = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") as Record<string, unknown>;
    const raw = v.cliId;
    const cliId = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    return {
      cliId,
      mode: typeof v.mode === "string" ? v.mode : undefined,
      provider: typeof v.provider === "string" ? v.provider : undefined,
      logos: typeof v.logos === "boolean" ? v.logos : undefined,
      runTimeout: typeof v.runTimeout === "number" ? v.runTimeout : undefined,
      maxWorkers: typeof v.maxWorkers === "number" ? v.maxWorkers : undefined,
    };
  } catch {
    return { cliId: null };
  }
}

/** Merge-update config and notify listeners (Explore, workers, usage meter). */
export function writeCliConfig(patch: Partial<CliConfig>): CliConfig {
  const prev = readCliConfig();
  const next: CliConfig = { ...prev, ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        mode: next.mode ?? prev.mode ?? "cli",
        cliId: next.cliId ?? "",
        provider: next.provider ?? prev.provider ?? "anthropic",
        logos: next.logos ?? prev.logos ?? true,
        runTimeout: next.runTimeout ?? prev.runTimeout ?? 230,
        maxWorkers: next.maxWorkers ?? prev.maxWorkers ?? 3,
      }),
    );
    window.dispatchEvent(new CustomEvent("co-config-changed"));
    if (patch.cliId && patch.cliId !== prev.cliId) {
      void fetch("/api/clis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliId: patch.cliId }) }).catch(() => {});
    }
  }
  return next;
}

export function cliDisplayName(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return CLI_NAMES[id] ?? id;
}

/** The machine's AI engine (saved on the server); cached in this browser for synchronous reads. */
export async function syncCliFromServer(): Promise<string | null> {
  try {
    const res = await fetch("/api/clis", { cache: "no-store" });
    if (!res.ok) return readCliConfig().cliId;
    const data = (await res.json()) as { selected?: string | null; saved?: boolean; clis?: { id: string; installed: boolean }[] };
    const local = readCliConfig().cliId;
    // First run on the server: keep the engine this browser already chose.
    if (!data.saved && local && data.clis?.some((c) => c.id === local && c.installed)) {
      await fetch("/api/clis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cliId: local }) }).catch(() => {});
      return local;
    }
    const selected = data.selected ?? null;
    if (selected !== readCliConfig().cliId && typeof window !== "undefined") {
      const prev = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...prev, mode: "cli", cliId: selected ?? "" }));
      window.dispatchEvent(new CustomEvent("co-config-changed"));
    }
    return selected;
  } catch {
    return readCliConfig().cliId;
  }
}

/** Resolve the engine for a run: this browser's cached choice, else the server's. */
export async function resolveCliIdForRun(): Promise<string | null> {
  return readCliConfig().cliId || syncCliFromServer();
}
