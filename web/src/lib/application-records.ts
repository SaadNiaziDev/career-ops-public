import { careerOpsRoot, readApplications, readApplicationStageHistory, type Application } from "@/lib/career-ops";
import { outreachSourceKey } from "@/lib/application-activity-outreach";
import { addDays, listOutreach, nextFollowup } from "@/lib/outreach";
import { readContacts, readDraft, type ContactRow } from "@/lib/contacts";
import { readActivity } from "@/lib/application-activity-store";
import type { ApplicationActivity, ActivityChannel } from "@/lib/application-activity-shared";
import type { OutreachRecord } from "@/lib/outreach-shared";

export type ApplicationRecord = { app: Application; events: ApplicationActivity[]; contacts: ContactRow[] };
export type ApplicationRecordSummary = { app: Application; lastActivity?: string; appliedAt?: string; method?: ActivityChannel; emails: number; followups: number; hasActivity: boolean; nextFollowUp?: string; followUpReason?: string };

/** Days after applying (with nothing heard or sent since) before a follow-up is suggested. */
export const FOLLOW_UP_AFTER_DAYS = 7;
const STALE_AFTER_DAYS = 21;

export function loadApplicationRecords(): ApplicationRecord[] {
  const root = careerOpsRoot();
  const contacts = readContacts();
  const outreach = listOutreach();
  const stages = readApplicationStageHistory();

  return readApplications().map((app) => {
    const events = readActivity(root, app.n);
    const sources = new Set(events.map((event) => event.sourceKey).filter(Boolean));
    for (const record of outreach.filter((item) => item.trackerNum === app.n)) {
      const sourceKey = outreachSourceKey(record);
      if (record.sentAt && record.status !== "ready" && !sources.has(sourceKey)) {
        events.push({ id: sourceKey, n: app.n, kind: "email", at: record.sentAt, channel: record.sentVia ?? "unknown", recipient: record.contact.email || record.contact.name, subject: record.subject, body: record.body, sourceKey, legacy: true });
      }
      for (const followup of record.followups.filter((f) => f.sentAt)) {
        const key = outreachSourceKey(record, followup.day);
        if (!sources.has(key)) events.push({ id: key, n: app.n, kind: "followup", at: followup.sentAt!, channel: record.sentVia ?? "unknown", recipient: record.contact.email || record.contact.name, subject: `Re: ${record.subject}`, body: followup.body, sourceKey: key, legacy: true });
      }
    }
    for (const stage of stages.filter((item) => item.n === app.n)) {
      events.push({ id: `stage:${stage.at}:${stage.to}`, n: app.n, kind: "status", at: stage.at, channel: "unknown", note: `${stage.from} → ${stage.to}` });
    }
    events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
    return { app, events, contacts: contacts.filter((contact) => contact.trackerNum === app.n) };
  });
}

/** When to follow up next: the next unsent step of an outreach thread, else 7 days after the last contact. */
function followUpFor(app: Application, events: ApplicationActivity[], appliedAt: string | undefined, threads: OutreachRecord[]): { date?: string; reason?: string } {
  if (!/^(Applied|Responded)$/i.test(app.status)) return {};
  for (const thread of threads.filter((o) => o.trackerNum === app.n)) {
    const next = nextFollowup(thread);
    if (next?.dueAt) return { date: next.dueAt, reason: `Day ${next.day} follow-up to ${thread.contact.name}` };
  }
  if (/^Responded$/i.test(app.status)) return {};
  const lastTouch = events.find((e) => e.kind === "application" || e.kind === "email" || e.kind === "followup")?.at ?? appliedAt ?? app.date;
  if (!lastTouch || Number.isNaN(Date.parse(lastTouch))) return {};
  // After three weeks of silence a follow-up rarely helps; flag it instead of nagging.
  if (addDays(lastTouch, STALE_AFTER_DAYS) < new Date().toISOString().slice(0, 10)) return { reason: "No reply in 3+ weeks" };
  return { date: addDays(lastTouch, FOLLOW_UP_AFTER_DAYS), reason: "No reply yet" };
}

export function summarizeRecord(record: ApplicationRecord, threads: OutreachRecord[] = listOutreach()): ApplicationRecordSummary {
  const { app, events } = record;
  const submission = events.find((event) => event.kind === "application");
  const next = followUpFor(app, events, submission?.at, threads);
  return {
    app, lastActivity: events[0]?.at, appliedAt: submission?.at, method: submission?.channel, nextFollowUp: next.date, followUpReason: next.reason,
    emails: events.filter((event) => event.kind === "email").length,
    followups: events.filter((event) => event.kind === "followup").length,
    hasActivity: events.some((event) => event.kind !== "status") || /^(Applied|Responded|Interview|Offer|Rejected)$/i.test(app.status),
  };
}

export function applicationDrafts(n: string) {
  return (["cover", "email", "contacto"] as const).flatMap((kind) => {
    const content = readDraft(n, kind);
    return content ? [{ kind, content }] : [];
  });
}

/** Summaries for the Track table (reads outreach threads once). */
export function summarizeRecords(records: ApplicationRecord[]): ApplicationRecordSummary[] {
  const threads = listOutreach();
  return records.map((record) => summarizeRecord(record, threads));
}
