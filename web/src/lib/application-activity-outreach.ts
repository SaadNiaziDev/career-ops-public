import { activityIdFor, saveActivity } from "./application-activity-store.ts";
import type { OutreachRecord } from "./outreach-shared";

export function outreachSourceKey(record: OutreachRecord, day?: number): string {
  return `outreach:${record.id}:${day == null ? "email" : `followup:${day}`}`;
}

/** One immutable snapshot per draft/follow-up, even when a request is retried. */
export function archiveOutreach(root: string, record: OutreachRecord, day?: number) {
  if (!record.trackerNum) return null;
  const followup = day == null ? undefined : record.followups.find((item) => item.day === day);
  const at = followup ? followup.sentAt : record.sentAt;
  if (!at || (day != null && !followup)) throw new Error("The message has not been confirmed sent.");
  const sourceKey = outreachSourceKey(record, day);
  return saveActivity(root, {
    id: activityIdFor(sourceKey), n: record.trackerNum, kind: followup ? "followup" : "email", at,
    channel: record.sentVia || "unknown", recipient: record.contact.email || record.contact.name,
    subject: followup ? `Re: ${record.subject}` : record.subject,
    body: followup ? followup.body : ["linkedin", "x"].includes(record.sentVia || "") ? record.linkedinNote || record.body : record.body,
    sourceKey,
  });
}
