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
  notes?: string;
};

export function FollowUpCard({
  followup,
  onLogged,
}: {
  followup: FollowUp;
  onLogged?: () => void;
}) {
  const [state, setState] = useState<"idle" | "logging" | "done" | "snoozed">("idle");
  if (state === "snoozed" || state === "done") return null;

  const log = async () => {
    setState("logging");
    try {
      await fetch("/api/followups/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: followup.num, company: followup.company, note: "Followed up" }),
      });
    } catch {
      /* best-effort */
    }
    onLogged?.();
    setState("done");
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
            {followup.appliedDate ? `Applied ${followup.appliedDate}` : "Follow-up due"}
          </p>
        </div>
      </div>
      <div className="md3-actions-row ml-auto">
        <Md3ActionButton variant="filled" icon="check" loading={state === "logging"} onClick={log}>
          Mark followed up
        </Md3ActionButton>
        {followup.num != null && (
          <Link href={`/pipeline/${followup.num}`} className="md3-action-btn md3-action-btn--text" aria-label="Open report">
            <span className="material-symbols-outlined text-[18px] leading-none">description</span>
          </Link>
        )}
        <Md3ActionButton variant="text" onClick={() => setState("snoozed")}>
          Snooze
        </Md3ActionButton>
      </div>
    </div>
  );
}
