"use client";

import { useCallback, useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

// Blueprint S13 · redline 3 — write-only keys. The browser learns that a key
// exists, how long it is and whether it still reaches its provider. It never
// receives the value, so there is nothing to reveal and no eye toggle.

type KeyStatus = {
  id: string;
  env: string;
  label: string;
  used: string;
  docs: string;
  present: boolean;
  origin: "env-file" | "process" | "none";
  length: number;
};

type Probe = { id: string; state: "valid" | "invalid" | "unknown"; detail: string };

const PROBE_LABEL: Record<Probe["state"], string> = {
  valid: "reachable",
  invalid: "rejected",
  unknown: "unverified",
};

function KeyRow({
  status,
  probe,
  onSave,
  onCheck,
}: {
  status: KeyStatus;
  probe?: Probe;
  onSave: (value: string) => Promise<void>;
  onCheck: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = draft.length > 0;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="keys-row">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {status.label}
          <span className="ml-2 font-mono text-[11px] text-[var(--md-sys-color-outline)]">{status.env}</span>
        </p>
        {status.present && (
          <span
            className={cn(
              "config-status-chip min-h-8 text-xs",
              probe?.state === "valid"
                ? "config-status-chip--ready"
                : probe?.state === "invalid"
                  ? "keys-chip--invalid"
                  : "config-status-chip--pending",
            )}
          >
            <MaterialSymbol
              name={probe?.state === "valid" ? "check" : probe?.state === "invalid" ? "error" : "help"}
              size={14}
            />
            {PROBE_LABEL[probe?.state ?? "unknown"]}
          </span>
        )}
      </div>

      <div className="md3-field mt-2 min-h-14 rounded-[var(--md-sys-shape-corner-large)]">
        <MaterialSymbol name="key" size={20} className="md3-field__icon" />
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={status.present ? `stored · ${status.length} characters` : "Paste a key to store it"}
          aria-label={`${status.label} API key`}
          className="md3-field__input font-mono text-sm"
        />
        {editing ? (
          <button
            type="button"
            className="md3-btn-text"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await onSave(draft);
                setDraft("");
              })
            }
          >
            Save
          </button>
        ) : status.present ? (
          <button type="button" className="md3-btn-text" disabled={busy} onClick={() => run(onCheck)}>
            {busy ? "Checking…" : "Check"}
          </button>
        ) : (
          <a href={status.docs} target="_blank" rel="noreferrer" className="md3-btn-text">
            Get one
          </a>
        )}
      </div>

      <p className="mt-1.5 text-xs text-[var(--md-sys-color-outline)]">
        {status.used}
        {status.origin === "process" && " · currently coming from the shell environment, not .env"}
        {probe?.state === "invalid" && ` · ${probe.detail}`}
      </p>

      {status.present && (
        <button
          type="button"
          className="mt-1 text-xs text-[var(--md-sys-color-error)] underline-offset-2 hover:underline"
          disabled={busy}
          onClick={() => run(() => onSave(""))}
        >
          Remove from .env
        </button>
      )}
    </div>
  );
}

export function KeysPanel() {
  const [keys, setKeys] = useState<KeyStatus[] | null>(null);
  const [probes, setProbes] = useState<Record<string, Probe>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      const data = (await res.json()) as { keys?: KeyStatus[] };
      setKeys(data.keys ?? []);
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(id: string, value: string) {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, value }),
    });
    const data = (await res.json()) as { keys?: KeyStatus[]; probe?: Probe };
    if (data.keys) setKeys(data.keys);
    if (data.probe) setProbes((p) => ({ ...p, [id]: data.probe! }));
  }

  async function check(id: string) {
    const res = await fetch(`/api/keys?check=${encodeURIComponent(id)}`);
    const data = (await res.json()) as { keys?: KeyStatus[]; probe?: Probe };
    if (data.keys) setKeys(data.keys);
    if (data.probe) setProbes((p) => ({ ...p, [id]: data.probe! }));
  }

  if (!keys) return <div className="config-panel__loading">Reading .env…</div>;

  return (
    <div className="flex flex-col gap-4">
      {keys.map((k) => (
        <KeyRow
          key={k.id}
          status={k}
          probe={probes[k.id]}
          onSave={(v) => save(k.id, v)}
          onCheck={() => check(k.id)}
        />
      ))}
    </div>
  );
}
