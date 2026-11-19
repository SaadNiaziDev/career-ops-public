"use client";

import { useEffect, useState } from "react";
import { Md3Textarea } from "@/components/ui/md3-input";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/providers/toast-provider";
import { followupSubject, gmailComposeUrl, type OutreachFollowup, type OutreachRecord } from "@/lib/outreach-shared";
import { patchItem, shortDate } from "./outreach-api";

/** One scheduled follow-up in the same email thread (day 3, 5 or 7). */
export function FollowupRow({ item, f, onChange }: { item: OutreachRecord; f: OutreachFollowup; onChange: (r: OutreachRecord) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState(f.body);
  const [opened, setOpened] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setText(f.body), [f.body]);
  const due = !f.sentAt && f.dueAt && f.dueAt <= new Date().toISOString().slice(0, 10);
  async function send() {
    if (!item.contact.email) {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast({ message: "Follow-up copied. Paste it in your LinkedIn or X thread.", tone: "neutral" });
    } else {
      window.open(gmailComposeUrl(item.contact.email, followupSubject(item.subject), text), "_blank", "noopener");
    }
    setOpened(true);
  }
  return (
    <div className="rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <strong>Day {f.day}</strong>
        {f.sentAt ? <Badge tone="good">Sent {shortDate(f.sentAt)}</Badge> : f.dueAt ? <Badge tone={due ? "bad" : "muted"}>{due ? "Due" : "Due"} {shortDate(f.dueAt)}</Badge> : <Badge>After you send</Badge>}
      </div>
      <Md3Textarea
        value={text}
        disabled={!!f.sentAt}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          if (text === f.body) return;
          const next = await patchItem({ id: item.id, action: "edit", day: f.day, body: text });
          if (next) onChange(next);
        }}
      />
      {item.status === "sent" && !f.sentAt && (
        <div className="mt-2">
          <Md3ActionButton variant={due ? "filled" : "outlined"} icon="reply" onClick={send}>
            {item.contact.email ? "Open follow-up in Gmail" : "Copy follow-up"}
          </Md3ActionButton>
        </div>
      )}
      {opened && !f.sentAt && <div className="mt-3 space-y-2"><p className="text-xs">Send the follow-up, then confirm. Update the text above if you changed it in your mail app.</p><Md3ActionButton loading={confirming} disabled={confirming} onClick={async () => { setConfirming(true); const next = await patchItem({ id: item.id, action: "followup-sent", day: f.day, body: text, confirmed: true }); setConfirming(false); if (next) { onChange(next); setOpened(false); } else toast({ message: "Could not record the follow-up.", tone: "error" }); }}>I sent this follow-up</Md3ActionButton></div>}
    </div>
  );
}
