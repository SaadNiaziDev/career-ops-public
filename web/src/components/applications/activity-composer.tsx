"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_CHANNELS, CHANNEL_LABELS, type ActivityInput, type ActivityKind } from "@/lib/application-activity-shared";
import { gmailComposeUrl } from "@/lib/outreach-shared";
import { Md3ActionButton } from "@/components/ui/md3-action-button";

export function ActivityComposer({ n, url, cvFile, score, submissionOnly = false, initialBody, onSaved }: {
  n: string; url?: string; cvFile?: string; score?: number; submissionOnly?: boolean; initialBody?: string; onSaved?: (result: { warning?: string; status?: string }) => void;
}) {
  const router = useRouter();
  const id = useRef<string | null>(null);
  const [kind, setKind] = useState<ActivityKind>(submissionOnly ? "application" : "email");
  const [channel, setChannel] = useState<ActivityInput["channel"]>(submissionOnly ? "company-site" : "email");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const message = kind === "email" || kind === "followup";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) || "").trim();
    id.current ??= crypto.randomUUID();
    setBusy(true); setError(""); setNotice("");
    try {
      const occurredAt = value("occurredAt");
      const response = await fetch("/api/application-activity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.current, n, kind, channel, confirmed, recipient: value("recipient"), subject: value("subject"), body: String(data.get("body") || ""), note: value("note"), url: value("url"), cvFile: value("cvFile"), overrideReason: value("overrideReason"), occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the record.");
      id.current = null;
      setNotice(result.warning || "Saved to this application's history.");
      setConfirmed(false);
      form.reset();
      onSaved?.({ warning: result.warning, status: result.status });
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the record."); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} onChange={() => { id.current = null; }} className="application-record-form space-y-3" aria-label={submissionOnly ? "Record submitted application" : "Add application activity"}>
      {!submissionOnly && <label>Record type<select value={kind} onChange={(event) => { id.current = null; setKind(event.target.value as ActivityKind); setConfirmed(false); }}>
        <option value="email">Email sent</option><option value="followup">Follow-up sent</option><option value="note">Note</option>
      </select></label>}
      {kind !== "note" && <div className="grid gap-3 sm:grid-cols-2">
        <label>{submissionOnly ? "How did you apply?" : "Sent via"}<select value={channel} onChange={(event) => setChannel(event.target.value as ActivityInput["channel"])}>
          {ACTIVITY_CHANNELS.filter((item) => item !== "unknown").map((item) => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}
        </select></label>
        <label>Date and time <span className="font-normal opacity-70">(blank = now)</span><input name="occurredAt" type="datetime-local" /></label>
      </div>}
      {submissionOnly && <>
        <label>Application link<input name="url" type="url" defaultValue={url} maxLength={2000} placeholder="https://company.com/jobs/…" /></label>
        <label>CV you submitted<input name="cvFile" defaultValue={cvFile} maxLength={500} placeholder="Filename or version, if used" /></label>
      </>}
      {(message || (submissionOnly && ["email", "gmail", "mail-app"].includes(channel))) && <>
        <label>Recipient<input name="recipient" required maxLength={500} placeholder="Name or email address" /></label>
        <label>Subject<input name="subject" maxLength={500} /></label>
        <label>Exact message sent<textarea name="body" defaultValue={initialBody} required rows={6} maxLength={20_000} /></label>
      </>}
      <label>{kind === "note" ? "Note" : "Notes or confirmation reference"}<textarea name="note" rows={2} required={kind === "note"} maxLength={2000} placeholder={submissionOnly ? "Confirmation number, referral, or anything to remember" : undefined} /></label>
      {submissionOnly && score != null && score < 4 && <label>Why apply below 4.0?<input name="overrideReason" required maxLength={500} /></label>}
      {message && <button type="button" className="md3-action-btn md3-action-btn--outlined" onClick={(event) => {
        const form = event.currentTarget.closest("form");
        if (!form) return;
        const data = new FormData(form);
        window.open(gmailComposeUrl(String(data.get("recipient") || ""), String(data.get("subject") || ""), String(data.get("body") || "")), "_blank", "noopener,noreferrer");
      }}>Open Gmail draft ↗</button>}
      {kind !== "note" && <label className="!flex items-start gap-2 !font-normal"><input type="checkbox" className="!mt-1 !w-auto" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required />
        <span>{submissionOnly ? "I submitted this application. These are the details I used." : "I sent this message. Opening a draft or copying it does not count as sent."}</span>
      </label>}
      <Md3ActionButton type="submit" icon="save" loading={busy} disabled={busy || (kind !== "note" && !confirmed)}>Save {submissionOnly ? "application record" : "activity"}</Md3ActionButton>
      {error && <p role="alert" className="text-sm text-[var(--md-sys-color-error)]">{error}</p>}
      {notice && <p role="status" className="text-sm text-[var(--md-sys-color-primary)]">{notice}</p>}
    </form>
  );
}
