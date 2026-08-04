"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { Button } from "@/components/ui/button";

export function DeleteFromTracker({ n }: { n: string }) {
  const router = useRouter();
  const [orphan, setOrphan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checked, setChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function loadOrphan() {
    if (checked) return true;
    setErr("");
    try {
      const r = await fetch("/api/tracker/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, dryRun: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "This row can't be removed.");
        return false;
      }
      setOrphan(d.orphanReport ?? null);
      setChecked(true);
      return true;
    } catch {
      setErr("Couldn't reach the tracker.");
      return false;
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/tracker/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "Delete failed.");
        setBusy(false);
        return;
      }
      router.push("/pipeline");
      router.refresh();
    } catch {
      setErr("Delete failed.");
      setBusy(false);
    }
  }

  function openConfirm() {
    if (err && checked) return;
    setConfirmOpen(true);
    void loadOrphan();
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {!confirmOpen ? (
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={!!err && checked}
          onClick={openConfirm}
          className="border-[var(--md-sys-color-error)] text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]"
        >
          <MaterialSymbol name="delete" size={16} />
          Remove from tracker
        </Button>
      ) : (
        <div className="md3-alert md3-alert--warning flex-col items-stretch">
          <p className="mb-0 text-sm font-medium">Permanently remove application #{n}?</p>
          <p className="mb-0 text-xs">
            This can&apos;t be undone.
            {orphan ? ` Its report file (${orphan}) is left on disk.` : ""}
          </p>
          <div className="md3-actions-row mt-1">
            <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => void confirmDelete()}
              className="bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)] hover:brightness-110"
            >
              {busy ? <MaterialSymbol name="progress_activity" size={16} className="animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </div>
      )}
      {err ? <span className="text-xs text-[var(--md-sys-color-error)]">{err}</span> : null}
    </div>
  );
}
