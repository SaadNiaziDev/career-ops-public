"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Select } from "@/components/ui/md3-select";
import { CANONICAL_STATES } from "@/lib/format";

export function StatusSelect({ n, current }: { n: string; current: string }) {
  const [status, setStatus] = useState(current);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onChange(next: string) {
    const prev = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, status: next }),
      });
      if (!res.ok) throw new Error("write failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setStatus(prev);
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
    <div className="flex items-center gap-2">
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
    </div>
  );
}
