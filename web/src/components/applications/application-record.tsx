"use client";

import { useEffect, useState } from "react";
import { LocalDate } from "./local-date";
import { ActivityComposer } from "./activity-composer";
import { ACTIVITY_LABELS, CHANNEL_LABELS, type ApplicationActivity } from "@/lib/application-activity-shared";
import type { ApplicationRecord } from "@/lib/application-records";

export function ApplicationTimeline({ events }: { events: ApplicationActivity[] }) {
  if (!events.length) return <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">No submission or messages have been recorded. Existing tracker statuses do not tell us how you applied.</p>;
  return <ol className="space-y-3" aria-label="Application history">{events.map((event) => (
    <li key={event.id} className="rounded-xl border border-[var(--md-sys-color-outline-variant)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-sm">{ACTIVITY_LABELS[event.kind]}</strong><LocalDate value={event.at} className="text-xs text-[var(--md-sys-color-on-surface-variant)]" /></div>
      {event.kind !== "note" && event.kind !== "status" && event.channel !== "unknown" && <p className="mt-1 text-sm">Via {CHANNEL_LABELS[event.channel]}{event.recipient ? ` · To ${event.recipient}` : ""}</p>}
      {event.channel === "unknown" && event.recipient && <p className="mt-1 text-sm">To {event.recipient}</p>}
      {event.cvFile && <p className="mt-1 break-all text-sm">CV submitted: {event.cvFile}</p>}
      {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-[var(--md-sys-color-primary)]">Application link ↗</a>}
      {event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.note}</p>}
      {event.body && <details className="mt-2"><summary className="cursor-pointer text-sm text-[var(--md-sys-color-primary)]">{event.subject || "View sent message"}</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{event.body}</pre></details>}
      {event.legacy && <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">Imported from existing records. Original sent text and submission details may be incomplete.</p>}
    </li>
  ))}</ol>;
}

export function ApplicationRecordPanel({ initial, drafts }: { initial: ApplicationRecord; drafts: { kind: string; content: string }[] }) {
  const [record, setRecord] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => setRecord(initial), [initial]);
  async function refresh() {
    try {
      const response = await fetch(`/api/application-activity?n=${record.app.n}`);
      if (!response.ok) throw new Error("Could not refresh the application history.");
      setRecord(await response.json()); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh history."); }
  }
  return <section className="space-y-5" aria-label="Application record">
    <div className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="md-title-large">Application history</h2></div>
      <ApplicationTimeline events={record.events} />
    </div>
    <details className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4"><summary className="cursor-pointer font-medium">Record an email, follow-up, or note</summary><div className="mt-4"><ActivityComposer n={record.app.n} onSaved={() => void refresh()} /></div></details>
    {record.contacts.length > 0 && <details className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4"><summary className="cursor-pointer font-medium">Contacts · {record.contacts.length}</summary><ul className="mt-3 space-y-3 text-sm">{record.contacts.map((contact, index) => <li key={index}><strong>{contact.name || contact.email}</strong> {contact.title}<p>{contact.email} {contact.channel ? `· ${contact.channel}` : ""}</p></li>)}</ul></details>}
    {drafts.length > 0 && <details className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4"><summary className="cursor-pointer font-medium">Saved drafts · {drafts.length} <span className="font-normal opacity-70">(not proof of sending)</span></summary><div className="mt-3 space-y-3">{drafts.map((draft) => <details key={draft.kind}><summary className="cursor-pointer text-sm">{draft.kind === "cover" ? "Cover letter" : draft.kind === "email" ? "Application email" : "Contact research"}</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{draft.content}</pre></details>)}</div></details>}
    {error && <p role="alert" className="text-sm text-[var(--md-sys-color-error)]">{error}</p>}
  </section>;
}
