"use client";

import { MaterialSymbol } from "@/components/shell/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useToast } from "@/components/providers/toast-provider";
import { LINKEDIN_NOTE_MAX, type OutreachRecord } from "@/lib/outreach-shared";

/** LinkedIn route: a connection note under the 300-character limit, then the message to send once they accept. */
export function LinkedInMessages({ item }: { item: OutreachRecord }) {
  const { toast } = useToast();
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast({ message: `${what} copied.`, tone: "neutral" });
  };
  const note = item.linkedinNote ?? "";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="md-title-medium">LinkedIn</h3>
        {item.contact.linkedin && (
          <a href={item.contact.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--md-sys-color-primary)] hover:underline">
            Open {item.contact.name.split(" ")[0]}&apos;s profile <MaterialSymbol name="arrow_outward" size={14} />
          </a>
        )}
      </div>
      {note && (
        <div className="space-y-2 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">1 · Connection note</span>
            <span className={note.length > LINKEDIN_NOTE_MAX ? "text-[var(--md-sys-color-error)]" : "text-[var(--md-sys-color-on-surface-variant)]"}>{note.length}/{LINKEDIN_NOTE_MAX}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{note}</p>
          <Md3ActionButton icon="content_copy" onClick={() => void copy(note, "Connection note")}>Copy note</Md3ActionButton>
        </div>
      )}
      {item.linkedinFollowup && (
        <div className="space-y-2 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
          <span className="text-sm font-medium">2 · Message after they accept</span>
          <p className="whitespace-pre-wrap text-sm">{item.linkedinFollowup}</p>
          <Md3ActionButton icon="content_copy" onClick={() => void copy(item.linkedinFollowup!, "Message")}>Copy message</Md3ActionButton>
        </div>
      )}
    </div>
  );
}
