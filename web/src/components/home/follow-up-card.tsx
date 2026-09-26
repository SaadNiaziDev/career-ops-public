"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { CompanyLogo } from "@/components/company-logo";
import type { ContactRow } from "@/lib/contacts";

export type FollowUp = {
  num?: number;
  company: string;
  role?: string;
  status?: string;
  urgency?: string;
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
  onLogged?: (warning?: string) => void;
  onSnoozed?: () => void;
}) {
  const [state, setState] = useState<"idle" | "composing" | "confirming" | "logging" | "done" | "snoozing" | "snoozed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactKey, setContactKey] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [until, setUntil] = useState(tomorrow);
  const [reason, setReason] = useState("");
  const contact = useMemo(() => contacts.find((row) => `${row.email}|${row.linkedin}|${row.name}` === contactKey) ?? null, [contacts, contactKey]);
  const contactName = contact?.name || "Hiring team";
  const emailUrl = contact?.email ? `mailto:${contact.email}?subject=${encodeURIComponent(`Following up — ${followup.role || "application"}`)}&body=${encodeURIComponent(draft)}` : "";
  const channelUrl = contact?.channel.toLowerCase().includes("linkedin") && contact.linkedin ? contact.linkedin : emailUrl;

  useEffect(() => {
    if (state !== "composing" || contacts.length || followup.num == null) return;
    fetch(`/api/contacts?tracker=${encodeURIComponent(String(followup.num))}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { contacts?: ContactRow[] } | null) => {
        const rows = Array.isArray(data?.contacts) ? data.contacts : [];
        setContacts(rows);
        const first = rows[0];
        if (first) {
          setContactKey(`${first.email}|${first.linkedin}|${first.name}`);
          setDraft(`Hi ${first.name || "there"},\n\nI’m following up on my application for ${followup.role || "the role"} at ${followup.company}. I remain interested and would appreciate any update when convenient.\n\nBest,\n[Your name]`);
        } else {
          setDraft(`Hello,\n\nI’m following up on my application for ${followup.role || "the role"} at ${followup.company}. I remain interested and would appreciate any update when convenient.\n\nBest,\n[Your name]`);
        }
      })
      .catch(() => setError("Contact details could not be loaded. You can still edit and copy this draft."));
  }, [state, contacts.length, followup.num, followup.company, followup.role]);

  if (state === "snoozed" || state === "done") return null;

  const log = async () => {
    setState("logging");
    try {
      const response = await fetch("/api/followups/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num: followup.num,
          company: followup.company,
          note,
          channel: contact?.channel || "manual",
          contactName: contact?.name || "",
          contactEmail: contact?.email || "",
          sentAt: new Date().toISOString(),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; contactUpdated?: boolean };
      if (!response.ok) throw new Error(result.error || "Could not log follow-up. Please retry.");
      setError(null);
      onLogged?.(result.contactUpdated === false ? "The follow-up was recorded, but the contact entry did not update." : undefined);
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
        <Md3ActionButton variant="filled" icon="edit_note" onClick={() => { setError(null); setState("composing"); }}>
          Draft follow-up
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
      {(state === "composing" || state === "confirming" || state === "logging") && <form className="basis-full space-y-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3" onSubmit={(event) => { event.preventDefault(); setState("confirming"); }}>
        {contacts.length > 0 && <label className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">Contact
          <select aria-label="Follow-up contact" className="ml-2 rounded border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] px-2 py-1" value={contactKey} onChange={(event) => {
            const selected = contacts.find((row) => `${row.email}|${row.linkedin}|${row.name}` === event.target.value);
            setContactKey(event.target.value);
            setDraft(`Hi ${selected?.name || "there"},\n\nI’m following up on my application for ${followup.role || "the role"} at ${followup.company}. I remain interested and would appreciate any update when convenient.\n\nBest,\n[Your name]`);
          }}>{contacts.map((row) => <option key={`${row.email}|${row.linkedin}|${row.name}`} value={`${row.email}|${row.linkedin}|${row.name}`}>{row.name || row.email || row.linkedin || "Saved contact"} · {row.verified || "unverified"}</option>)}</select>
        </label>}
        {contact && <p className="mb-0 text-xs text-[var(--md-sys-color-on-surface-variant)]">Prior touch: {contact.lastTouch || "none recorded"}{contact.notes ? ` · ${contact.notes}` : ""}</p>}
        {contact && contact.verified !== "verified" && <p className="mb-0 text-xs text-[var(--md-sys-color-error)]">This contact is marked {contact.verified || "unverified"}. Check the details before opening a channel.</p>}
        <label className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">Edit the message
          <textarea aria-label="Follow-up draft" value={draft} onChange={(event) => setDraft(event.target.value)} rows={6} className="mt-1 block w-full rounded border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] p-3 text-sm text-[var(--md-sys-color-on-surface)]" />
        </label>
        {state === "confirming" || state === "logging" ? <>
          <p className="mb-0 text-sm text-[var(--md-sys-color-on-surface-variant)]">Confirm only after you sent this to {contactName}{contact?.channel ? ` via ${contact.channel}` : ""}.</p>
          <label className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">Optional note
            <input aria-label="Follow-up note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="What you sent or agreed" className="mt-1 block w-full rounded border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] px-3 py-2 text-sm" />
          </label>
        </> : null}
        <div className="flex flex-wrap gap-2">
          <Md3ActionButton type="button" variant="outlined" icon="content_copy" onClick={() => void navigator.clipboard.writeText(draft).then(() => setError(null)).catch(() => setError("Clipboard access failed. Select and copy the draft manually."))}>Copy draft</Md3ActionButton>
          {channelUrl && <a href={channelUrl} target={channelUrl.startsWith("http") ? "_blank" : undefined} rel={channelUrl.startsWith("http") ? "noreferrer" : undefined} className="md3-btn-outlined min-h-10 px-4">Open {contact?.channel || "email"}</a>}
          {state === "composing" ? <Md3ActionButton type="submit" variant="filled">I sent it</Md3ActionButton> : <Md3ActionButton type="button" variant="filled" loading={state === "logging"} disabled={state === "logging"} onClick={() => void log()}>Confirm sent</Md3ActionButton>}
          <Md3ActionButton type="button" variant="text" onClick={() => setState("idle")}>Cancel</Md3ActionButton>
        </div>
      </form>}
      {state === "snoozing" && <form className="basis-full grid gap-2 sm:grid-cols-[auto_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void snooze(); }}>
        <label className="text-xs">Return date<input type="date" min={tomorrow} value={until} onChange={(event) => setUntil(event.target.value)} required className="ml-2 rounded border border-[var(--md-sys-color-outline-variant)] bg-transparent px-2 py-1" /></label>
        <input aria-label="Snooze reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={300} placeholder="Why should this wait?" className="min-w-0 rounded border border-[var(--md-sys-color-outline-variant)] bg-transparent px-2 py-1 text-sm" />
        <Md3ActionButton type="submit" variant="filled">Save snooze</Md3ActionButton>
      </form>}
      {error && <p role="alert" className="basis-full text-sm text-[var(--md-sys-color-error)]">{error}</p>}
    </div>
  );
}
