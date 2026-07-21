"use client";

import { useCallback, useEffect, useState } from "react";

export const CONFIG_KEY = "career-ops:config";

export type CliConfig = {
  cliId: string | null;
  mode?: string;
  provider?: string;
  logos?: boolean;
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
      }),
    );
    window.dispatchEvent(new CustomEvent("co-config-changed"));
  }
  return next;
}

export function cliDisplayName(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return CLI_NAMES[id] ?? id;
}

/** Resolve cliId from localStorage, or auto-pick the first installed CLI on this machine. */
export async function resolveCliIdForRun(): Promise<string | null> {
  const saved = readCliConfig().cliId;
  if (saved) return saved;

  try {
    const res = await fetch("/api/clis");
    if (!res.ok) return null;
    const data = (await res.json()) as { clis?: { id: string; installed: boolean }[] };
    const first = (data.clis ?? []).find((c) => c.installed);
    if (!first) return null;
    writeCliConfig({ cliId: first.id, mode: "cli" });
    return first.id;
  } catch {
    return null;
  }
}

export function useCliConfig() {
  const [config, setConfig] = useState<CliConfig>({ cliId: null });

  const refresh = useCallback(() => {
    setConfig(readCliConfig());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("co-config-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("co-config-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return {
    cliId: config.cliId,
    cliConfigured: !!config.cliId,
    cliName: cliDisplayName(config.cliId),
    refresh,
  };
}
