"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Select } from "@/components/ui/md3-select";
import { CANONICAL_STATES } from "@/lib/format";

export function StatusSelect({ n, current, score }: { n: string; current: string; score?: string }) {
  const [status, setStatus] = useState(current);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onChange(next: string) {
    const prev = status;
    let overrideReason: string | undefined;
    const scoreValue = Number.parseFloat(String(score ?? "").replace(/[^\d.\-]/g, ""));
    if (next === "Applied" && Number.isFinite(scoreValue) && scoreValue < 4) {
      overrideReason = window.prompt("This role scored below 4.0. Why do you want to apply anyway?")?.trim();
      if (!overrideReason) return;
    }
    setStatus(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, status: next, overrideReason }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Status update failed. Please retry.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (cause) {
      setStatus(prev);
      setError(cause instanceof Error ? cause.message : "Status update failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  const known = (CANONICAL_STATES as readonly string[]).includes(status);
  const options = [
    ...(!known ? [{ value: status, label: status }] : []),
    ...CANONICAL_STATES.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Md3Select
        value={status}
        onChange={(next) => void onChange(next)}
        options={options}
        disabled={busy}
        className="min-w-[120px]"
        aria-label="Application status"
      />
      {saved ? (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-tertiary)]">
          <MaterialSymbol name="check" size={14} />
          saved
        </span>
      ) : null}
      {error && <span role="alert" className="text-xs text-[var(--md-sys-color-error)]">{error}</span>}
    </div>
  );
}
