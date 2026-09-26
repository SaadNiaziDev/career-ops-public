"use client";

import { useState } from "react";
import Link from "next/link";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { CompanyLogo } from "@/components/company-logo";

export type FollowUp = {
  num?: number;
  company: string;
  role?: string;
  status?: string;
  appliedDate?: string;
  nextFollowupDate?: string;
  notes?: string;
  snoozedUntil?: string;
  snoozeReason?: string;
};

export function FollowUpCard({
  followup,
  onLogged,
  onSnoozed,
}: {
  followup: FollowUp;
  onLogged?: () => void;
  onSnoozed?: () => void;
}) {
  const [state, setState] = useState<"idle" | "logging" | "done" | "snoozing" | "snoozed">("idle");
  const [error, setError] = useState<string | null>(null);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [until, setUntil] = useState(tomorrow);
  const [reason, setReason] = useState("");
  if (state === "snoozed" || state === "done") return null;

  const log = async () => {
    setState("logging");
    try {
      const response = await fetch("/api/followups/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: followup.num, company: followup.company, note: "Followed up" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not log follow-up. Please retry.");
      setError(null);
      onLogged?.();
      setState("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log follow-up. Please retry.");
      setState("idle");
    }
  };

  const snooze = async () => {
    setError(null);
    try {
      const response = await fetch("/api/followups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: followup.num, until, reason }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save snooze. Please retry.");
      onSnoozed?.();
      setState("snoozed");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save snooze. Please retry."); }
  };

  return (
    <div className="dossier-followup flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--md-sys-shape-corner-large-increased)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] px-4 py-3">
      <div className="flex min-w-0 flex-[1_1_55%] items-center gap-3">
        <CompanyLogo name={followup.company} size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate md-body-medium text-[var(--md-sys-color-on-surface)]">
            <span className="font-medium">{followup.company}</span>
            {followup.role && (
              <span className="text-[var(--md-sys-color-on-surface-variant)]"> · {followup.role}</span>
            )}
          </p>
          <p className="flex items-center gap-1 md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            <span className="material-symbols-outlined text-[14px] leading-none">schedule</span>
            {followup.nextFollowupDate ? `Due ${followup.nextFollowupDate}` : followup.appliedDate ? `Applied ${followup.appliedDate}` : "Follow-up due"}
          </p>
        </div>
      </div>
      <div className="md3-actions-row ml-auto">
        <Md3ActionButton variant="filled" icon="check" loading={state === "logging"} disabled={state === "logging"} onClick={() => void log()}>
          Mark followed up
        </Md3ActionButton>
        {followup.num != null && (
          <Link href={`/pipeline/${followup.num}`} className="md3-action-btn md3-action-btn--text" aria-label="Open report">
            <span className="material-symbols-outlined text-[18px] leading-none">description</span>
          </Link>
        )}
        <Md3ActionButton variant="text" onClick={() => setState("snoozing")}>
          Snooze
        </Md3ActionButton>
      </div>
      {state === "snoozing" && <form className="basis-full grid gap-2 sm:grid-cols-[auto_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void snooze(); }}>
        <label className="text-xs">Return date<input type="date" min={tomorrow} value={until} onChange={(event) => setUntil(event.target.value)} required className="ml-2 rounded border border-[var(--md-sys-color-outline-variant)] bg-transparent px-2 py-1" /></label>
        <input aria-label="Snooze reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={300} placeholder="Why should this wait?" className="min-w-0 rounded border border-[var(--md-sys-color-outline-variant)] bg-transparent px-2 py-1 text-sm" />
        <Md3ActionButton type="submit" variant="filled">Save snooze</Md3ActionButton>
      </form>}
      {error && <p role="alert" className="basis-full text-sm text-[var(--md-sys-color-error)]">{error}</p>}
    </div>
  );
}
