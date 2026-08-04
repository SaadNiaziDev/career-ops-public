"use client";

import { useState } from "react";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Input } from "@/components/ui/md3-input";
import { cn } from "@/lib/cn";

type Props = {
  onAdded?: () => void;
};

export function AddCompanyCard({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const [atsUrl, setAtsUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);

  const flash = (tone: "info" | "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const reset = () => {
    setName("");
    setCareersUrl("");
    setAtsUrl("");
    setNotes("");
  };

  const submit = async () => {
    if (!name.trim() || !careersUrl.trim()) {
      flash("error", "Company name and careers URL are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/portals/add-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, careers_url: careersUrl, api: atsUrl, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add company");
      flash("success", `Added "${name.trim()}" to portals.yml — re-scan to pick it up.`);
      reset();
      setOpen(false);
      onAdded?.();
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Could not add company");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Md3ActionButton variant="outlined" icon="add_business" onClick={() => setOpen(true)}>
        Add a company
      </Md3ActionButton>
    );
  }

  return (
    <Md3Card className="mt-4" title={<span className="md-title-medium">Add a company to track</span>}>
      {notice && (
        <p className={cn("md3-alert mb-3", `md3-alert--${notice.tone}`)}>{notice.text}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Md3Input
          icon="business"
          placeholder="Company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Md3Input
          icon="link"
          type="url"
          placeholder="Official careers URL (https://…)"
          value={careersUrl}
          onChange={(e) => setCareersUrl(e.target.value)}
        />
        <Md3Input
          icon="alt_route"
          type="url"
          placeholder="Alternate ATS URL (optional — Greenhouse/Lever/Breezy…)"
          value={atsUrl}
          onChange={(e) => setAtsUrl(e.target.value)}
        />
        <Md3Input
          icon="notes"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <p className="mt-2 md-body-small text-[var(--md-sys-color-on-surface-variant)]">
        Writes to <code>portals.yml</code>&apos;s <code>tracked_companies</code>. If the alternate URL is a known ATS
        (Greenhouse/Lever/Breezy board), the scanner reads it directly; otherwise it falls back to search.
      </p>
      <div className="md3-actions-row mt-4">
        <Md3ActionButton variant="filled" loading={busy} onClick={() => void submit()}>
          Add company
        </Md3ActionButton>
        <Md3ActionButton variant="text" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Md3ActionButton>
      </div>
    </Md3Card>
  );
}
