"use client";

import { useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import {
  DEFAULT_WEIGHTS,
  rebalanceWeights,
  sameWeights,
  WEIGHT_HINT,
  WEIGHT_KEYS,
  WEIGHT_LABEL,
  type Weights,
} from "@/lib/weights";
import { cn } from "@/lib/cn";

/**
 * Blueprint S13 · gap 4 — the ranking arithmetic Explore and Report both cite
 * is editable here and nowhere else. Sliders always sum to 100.
 */
export function WeightsEditor() {
  const [weights, setWeights] = useState<Weights | null>(null);
  const [saved, setSaved] = useState<Weights | null>(null);
  const [source, setSource] = useState<"portals" | "default">("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/portals/weights")
      .then((r) => r.json())
      .then((d: { weights?: Weights; source?: "portals" | "default" }) => {
        if (!live) return;
        const w = d.weights ?? DEFAULT_WEIGHTS;
        setWeights(w);
        setSaved(w);
        setSource(d.source ?? "default");
      })
      .catch(() => {
        if (!live) return;
        setWeights({ ...DEFAULT_WEIGHTS });
        setSaved({ ...DEFAULT_WEIGHTS });
      });
    return () => {
      live = false;
    };
  }, []);

  async function persist() {
    if (!weights) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portals/weights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const data = (await res.json()) as { weights?: Weights; error?: string };
      if (!res.ok || !data.weights) throw new Error(data.error || "write failed");
      setWeights(data.weights);
      setSaved(data.weights);
      setSource("portals");
    } catch (e) {
      setError(e instanceof Error ? e.message : "write failed");
    } finally {
      setBusy(false);
    }
  }

  if (!weights || !saved) {
    return <div className="config-panel__loading">Reading portals.yml…</div>;
  }

  const dirty = !sameWeights(weights, saved);
  const total = WEIGHT_KEYS.reduce((a, k) => a + weights[k], 0);

  return (
    <div>
      {WEIGHT_KEYS.map((k) => (
        <div key={k} className="weights-row">
          <div className="min-w-0">
            <label htmlFor={`weight-${k}`} className="block text-sm font-medium">
              {WEIGHT_LABEL[k]}
            </label>
            <p className="mt-0.5 text-[11px] text-[var(--md-sys-color-outline)]">{WEIGHT_HINT[k]}</p>
          </div>
          <input
            id={`weight-${k}`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={weights[k]}
            onChange={(e) => setWeights(rebalanceWeights(weights, k, Number(e.target.value)))}
            className="min-w-0 accent-[var(--md-sys-color-primary)]"
          />
          <span className="w-12 text-right font-mono text-sm tabular-nums">{weights[k]}%</span>
        </div>
      ))}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-4">
        <span
          className={cn(
            "config-status-chip",
            total === 100 ? "config-status-chip--ready" : "config-status-chip--pending",
          )}
        >
          <MaterialSymbol name={total === 100 ? "check" : "warning"} size={16} />
          Sums to {total}
        </span>
        <span className="text-xs text-[var(--md-sys-color-outline)]">
          {source === "portals" ? "Read from portals.yml" : "Defaults — portals.yml has no ranking block yet"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="md3-btn-text"
            onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
            disabled={busy}
          >
            Reset
          </button>
          <button type="button" className="md3-btn-filled min-h-10" onClick={persist} disabled={!dirty || busy}>
            {busy ? "Writing…" : dirty ? "Write to portals.yml" : "Saved"}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-[var(--md-sys-color-error)]">Could not write portals.yml — {error}</p>
      )}
    </div>
  );
}
