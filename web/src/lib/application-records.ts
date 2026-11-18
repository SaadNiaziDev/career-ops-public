import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications, readApplicationStageHistory, type Application } from "@/lib/career-ops";
import { outreachSourceKey } from "@/lib/application-activity-outreach";
import { listOutreach } from "@/lib/outreach";
import { readContacts, readDraft, type ContactRow } from "@/lib/contacts";
import { readActivity } from "@/lib/application-activity-store";
import type { ApplicationActivity, ActivityChannel } from "@/lib/application-activity-shared";

export type ApplicationRecord = { app: Application; events: ApplicationActivity[]; contacts: ContactRow[] };
export type ApplicationRecordSummary = { app: Application; lastActivity?: string; appliedAt?: string; method?: ActivityChannel; emails: number; followups: number; hasActivity: boolean };

export function loadApplicationRecords(): ApplicationRecord[] {
  const root = careerOpsRoot();
  const contacts = readContacts();
  const outreach = listOutreach();
  const stages = readApplicationStageHistory();
  let followups = "";
  try { followups = fs.readFileSync(path.join(root, "data/follow-ups.md"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

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
    for (const [index, line] of followups.split(/\r?\n/).entries()) {
      const match = line.match(/^- (\d{4}-\d{2}-\d{2}) · #(\d+) /);
      if (match?.[2] === app.n && !sources.has(`followup-log:${match[1]}:${app.n}`)) events.push({ id: `legacy-followup:${index}`, n: app.n, kind: "followup", at: match[1], channel: "unknown", note: line.replace(/^- /, ""), legacy: true });
    }
    events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
    return { app, events, contacts: contacts.filter((contact) => contact.trackerNum === app.n) };
  });
}

export function summarizeRecord(record: ApplicationRecord): ApplicationRecordSummary {
  const { app, events } = record;
  const submission = events.find((event) => event.kind === "application");
  return {
    app, lastActivity: events[0]?.at, appliedAt: submission?.at, method: submission?.channel,
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
