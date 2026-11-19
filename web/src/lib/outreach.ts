import { db } from "@/lib/db";
import {
  addDays,
  fitLinkedInNote,
  FOLLOWUP_DAYS,
  type EmailConfidence,
  type OutreachFollowup,
  type OutreachPerson,
  type OutreachRecord,
} from "@/lib/outreach-shared";

export * from "@/lib/outreach-shared";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function listOutreach(): OutreachRecord[] {
  const rows = db().prepare("SELECT data FROM outreach ORDER BY updated_at DESC").all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as OutreachRecord);
}

export function readOutreach(id: string): OutreachRecord | null {
  if (!ID_RE.test(id)) return null;
  const row = db().prepare("SELECT data FROM outreach WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as OutreachRecord) : null;
}

export function saveOutreach(record: OutreachRecord): void {
  if (!ID_RE.test(record.id)) throw new Error("invalid outreach id");
  db().prepare(`INSERT INTO outreach (id, tracker_num, updated_at, data) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET tracker_num = excluded.tracker_num, updated_at = excluded.updated_at, data = excluded.data`)
    .run(record.id, record.trackerNum ?? null, record.updatedAt || new Date().toISOString(), JSON.stringify(record));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "role";
}

const str = (v: unknown, max = 4000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;

function person(raw: unknown): OutreachPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 120);
  if (!name) return null;
  let email = str(r.email, 200);
  let emailConfidence = (["found", "pattern", "none"].includes(str(r.emailConfidence)) ? str(r.emailConfidence) : "none") as EmailConfidence;
  if (!EMAIL_RE.test(email)) {
    email = "";
    emailConfidence = "none";
  }
  if (email && emailConfidence === "none") emailConfidence = "pattern";
  const url = (v: unknown) => (/^https?:\/\//i.test(str(v, 500)) ? str(v, 500) : "");
  return {
    name,
    title: str(r.title, 160),
    email,
    emailConfidence,
    emailEvidence: url(r.emailEvidence) || undefined,
    linkedin: url(r.linkedin) || undefined,
    x: url(r.x) || undefined,
    sourceUrl: url(r.sourceUrl) || undefined,
    why: str(r.why, 400) || undefined,
  };
}

/** Pull the LAST ```json block from worker output and validate it into a record. */
export function parseOutreachOutput(
  text: string,
  meta: { trackerNum?: string; jobUrl?: string; tone?: string },
): OutreachRecord | { error: string } {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const rawJson = blocks.at(-1)?.[1];
  if (!rawJson) return { error: "The worker finished without returning the outreach result." };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return { error: "The outreach result was not valid JSON." };
  }
  const contact = person(data.contact);
  if (!contact) return { error: "No hiring contact could be confirmed for this role." };
  const subject = str(data.subject, 200);
  const body = str(data.body, 6000);
  if (!subject || !body) return { error: "The outreach result had no email subject or body." };
  const company = str(data.company, 120) || "Unknown company";
  const role = str(data.role, 160);
  const followups: OutreachFollowup[] = Array.isArray(data.followups)
    ? (data.followups as unknown[])
        .map((f, i) => {
          const r = (f ?? {}) as Record<string, unknown>;
          const day = typeof r.day === "number" && r.day > 0 && r.day < 60 ? Math.round(r.day) : FOLLOWUP_DAYS[i] ?? 7;
          return { day, body: str(r.body, 3000) };
        })
        .filter((f) => f.body)
        .slice(0, 3)
    : [];
  const now = new Date().toISOString();
  const jobUrl = str(data.jobUrl, 500) || meta.jobUrl;
  return {
    id: `${meta.trackerNum ? `${meta.trackerNum}-` : ""}${slug(company)}-${slug(contact.name)}-${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    trackerNum: meta.trackerNum,
    company,
    role,
    jobUrl: /^https?:\/\//i.test(jobUrl ?? "") ? jobUrl : undefined,
    companyDomain: str(data.companyDomain, 120) || undefined,
    contact,
    alternates: Array.isArray(data.alternates) ? (data.alternates as unknown[]).map(person).filter((p): p is OutreachPerson => Boolean(p)).slice(0, 3) : [],
    subject,
    body,
    linkedinNote: fitLinkedInNote(str(data.linkedinNote, 1000)) || undefined,
    linkedinFollowup: str(data.linkedinFollowup, 1500) || undefined,
    followups,
    status: "ready",
    tone: meta.tone,
  };
}

export function scheduleFollowups(record: OutreachRecord, sentAt: string): OutreachFollowup[] {
  return record.followups.map((f) => ({ ...f, dueAt: addDays(sentAt, f.day) }));
}
