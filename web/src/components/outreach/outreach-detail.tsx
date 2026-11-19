"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Md3Input, Md3Textarea } from "@/components/ui/md3-input";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/providers/toast-provider";
import { gmailComposeUrl, mailtoUrl, type OutreachPerson, type OutreachRecord, type SentVia } from "@/lib/outreach-shared";
import { FollowupRow } from "./followup-row";
import { LinkedInMessages } from "./linkedin-messages";
import { patchItem, shortDate } from "./outreach-api";

function EmailBadge({ p }: { p: OutreachPerson }) {
  if (p.emailConfidence === "found") return <Badge tone="good">Email found</Badge>;
  if (p.emailConfidence === "pattern") return <Badge tone="warn">Guessed from company pattern</Badge>;
  return <Badge tone="muted">No email, use LinkedIn or X</Badge>;
}

function Initial({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--md-sys-color-primary-container)] text-sm font-semibold text-[var(--md-sys-color-on-primary-container)]">
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

/** One hiring contact and the email to them: review, open in Gmail or your mail app, then confirm it was sent. */
export function OutreachDetail({ item, onChange }: { item: OutreachRecord; onChange: (r: OutreachRecord) => void }) {
  const { toast } = useToast();
  const [to, setTo] = useState(item.contact.email);
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [openedVia, setOpenedVia] = useState<SentVia | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setTo(item.contact.email);
    setSubject(item.subject);
    setBody(item.body);
  }, [item.id, item.contact.email, item.subject, item.body]);

  const persist = useCallback(async () => {
    if (subject === item.subject && body === item.body) return;
    const next = await patchItem({ id: item.id, action: "edit", subject, body });
    if (next) onChange(next);
  }, [subject, body, item, onChange]);

  async function markSent() {
    if (!openedVia || confirming) return;
    setConfirming(true);
    const next = await patchItem({ id: item.id, action: "sent", via: openedVia, confirmed: true, recipient: to, subject, body });
    setConfirming(false);
    if (!next) return toast({ message: "Could not record the sent message.", tone: "error" });
    onChange(next);
    setOpenedVia(null);
    toast({ message: "Sent message saved. Follow-ups are scheduled, and the exact text is available in Track.", tone: "neutral" });
  }

  function sendGmail() {
    if (!to) return;
    window.open(gmailComposeUrl(to, subject, body), "_blank", "noopener");
    setOpenedVia("gmail");
  }
  function sendMailApp() {
    if (!to) return;
    window.location.href = mailtoUrl(to, subject, body);
    setOpenedVia("mail-app");
  }
  async function sendSocial(via: "linkedin" | "x") {
    const url = via === "linkedin" ? item.contact.linkedin : item.contact.x;
    await navigator.clipboard.writeText(item.linkedinNote || body).catch(() => {});
    if (url) window.open(url, "_blank", "noopener");
    setOpenedVia(via);
  }
  async function act(action: "replied" | "dismiss" | "restore") {
    const next = await patchItem({ id: item.id, action });
    if (next) onChange(next);
  }
  async function useAlternate(index: number) {
    const next = await patchItem({ id: item.id, action: "use-alternate", index });
    if (next) onChange(next);
  }

  const c = item.contact;
  const locked = item.status !== "ready";
  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="md-title-large truncate">{item.role || item.company}</h2>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
            {item.company}
            {item.trackerNum && (
              <> · <Link className="text-[var(--md-sys-color-primary)] hover:underline" href={`/pipeline/${item.trackerNum}`}>#{item.trackerNum}</Link></>
            )}
            {item.jobUrl && (
              <> · <a className="text-[var(--md-sys-color-primary)] hover:underline" href={item.jobUrl} target="_blank" rel="noreferrer">job post</a></>
            )}
          </p>
        </div>
        {item.status === "sent" && <Badge tone="good">Sent {shortDate(item.sentAt)}{item.sentVia === "gmail" ? " from Gmail" : ""}</Badge>}
        {item.status === "replied" && <Badge tone="good">Replied</Badge>}
        {item.status === "dismissed" && <Badge>Dismissed</Badge>}
      </div>

      <div className="rounded-2xl bg-[var(--md-sys-color-surface-container)] p-4">
        <div className="flex items-start gap-3">
          <Initial name={c.name} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{c.name}</p>
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{c.title}</p>
            {c.why && <p className="mt-1 text-sm">{c.why}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <EmailBadge p={c} />
              {c.emailEvidence && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.emailEvidence} target="_blank" rel="noreferrer">email evidence</a>}
              {c.sourceUrl && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.sourceUrl} target="_blank" rel="noreferrer">source</a>}
              {c.linkedin && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
              {c.x && <a className="text-[var(--md-sys-color-primary)] hover:underline" href={c.x} target="_blank" rel="noreferrer">X</a>}
            </div>
          </div>
        </div>
        {item.alternates.length > 0 && item.status === "ready" && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--md-sys-color-outline-variant)] pt-3 text-sm">
            <span className="text-[var(--md-sys-color-on-surface-variant)]">Or write to</span>
            {item.alternates.map((a, i) => (
              <button key={`${a.name}-${i}`} type="button" onClick={() => useAlternate(i)} className="rounded-full border border-[var(--md-sys-color-outline-variant)] px-3 py-1 hover:bg-[var(--md-sys-color-surface-container-high)]" title={a.why}>
                {a.name}{a.title ? `, ${a.title}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">To</span>
          <Md3Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="No email found, add one if you know it" disabled={locked} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Subject</span>
          <Md3Input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={persist} disabled={locked} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Email</span>
          <Md3Textarea value={body} rows={12} onChange={(e) => setBody(e.target.value)} onBlur={persist} disabled={locked} />
        </label>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{body.trim().split(/\s+/).filter(Boolean).length} words</p>
      </div>

      {item.status === "ready" && (
        <div className="flex flex-wrap gap-2">
          <Md3ActionButton variant="filled" icon="send" disabled={!to} onClick={sendGmail}>Open Gmail draft</Md3ActionButton>
          <Md3ActionButton icon="mail" disabled={!to} onClick={sendMailApp}>Mail app</Md3ActionButton>
          {c.linkedin && <Md3ActionButton icon="link" onClick={() => sendSocial("linkedin")}>LinkedIn</Md3ActionButton>}
          {c.x && <Md3ActionButton icon="alternate_email" onClick={() => sendSocial("x")}>X</Md3ActionButton>}
          <Md3ActionButton variant="text" icon="content_copy" onClick={async () => { await navigator.clipboard.writeText(`${subject}\n\n${body}`).catch(() => {}); toast({ message: "Copied.", tone: "neutral" }); }}>Copy</Md3ActionButton>
          <Md3ActionButton variant="text" icon="close" onClick={() => act("dismiss")}>Skip</Md3ActionButton>
        </div>
      )}
      {openedVia && item.status === "ready" && (
        <div className="space-y-2 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
          <p className="text-sm">Review and send in your mail app or message thread, then confirm here. If you edited the text there, update the copy above before recording it.</p>
          <div className="flex flex-wrap gap-2"><Md3ActionButton icon="check" onClick={() => void markSent()} loading={confirming} disabled={confirming}>I sent this message</Md3ActionButton><Md3ActionButton variant="text" onClick={() => setOpenedVia(null)} disabled={confirming}>Not sent yet</Md3ActionButton></div>
        </div>
      )}
      {c.emailConfidence === "pattern" && item.status === "ready" && (
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">This address follows the company's email format but wasn't published. If it bounces, use LinkedIn or one of the other people above.</p>
      )}

      {(item.linkedinNote || item.linkedinFollowup) && item.status !== "dismissed" && <LinkedInMessages item={item} />}

      {item.followups.length > 0 && item.status !== "dismissed" && (
        <div className="space-y-3">
          <h3 className="md-title-medium">Follow-ups</h3>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">A short follow-up often gets the reply the first email didn't. They show up under "Follow-ups due" on the right day.</p>
          {item.followups.map((f) => <FollowupRow key={f.day} item={item} f={f} onChange={onChange} />)}
        </div>
      )}

      {item.status === "sent" && (
        <div className="flex flex-wrap gap-2">
          <Md3ActionButton icon="mark_email_read" onClick={() => act("replied")}>They replied, stop follow-ups</Md3ActionButton>
        </div>
      )}
      {item.status === "dismissed" && <Md3ActionButton icon="undo" onClick={() => act("restore")}>Restore</Md3ActionButton>}
    </div>
  );
}
