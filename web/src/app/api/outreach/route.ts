import { careerOpsRoot } from "@/lib/career-ops";
import { archiveOutreach } from "@/lib/application-activity-outreach";
import { NextResponse } from "next/server";
import { appendContact, updateContact } from "@/lib/contacts";
import { readBoundedJson } from "@/lib/core/request-bounds";
import { listOutreach, readOutreach, saveOutreach, scheduleFollowups, type OutreachRecord, type SentVia } from "@/lib/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIAS: SentVia[] = ["gmail", "mail-app", "linkedin", "x", "other"];

export async function GET() {
  return NextResponse.json({ items: listOutreach() });
}

type Patch = {
  id?: string;
  action?: "edit" | "sent" | "unsend" | "followup-sent" | "replied" | "dismiss" | "restore" | "use-alternate";
  subject?: string;
  body?: string;
  via?: string;
  day?: number;
  index?: number;
  confirmed?: boolean;
  recipient?: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Mirror the send into contacts.tsv so the Contacts page and follow-up cadence see it. */
function logContact(record: OutreachRecord, via: SentVia) {
  const c = record.contact;
  const channel = via === "gmail" || via === "mail-app" ? "email" : via;
  try {
    appendContact({
      trackerNum: record.trackerNum ?? "",
      company: record.company,
      role: record.role,
      name: c.name,
      title: c.title,
      channel,
      email: c.email,
      linkedin: c.linkedin ?? "",
      verified: c.emailConfidence === "found" ? "verified" : "unverified",
      source: c.sourceUrl ?? "outreach",
      notes: c.emailConfidence === "pattern" ? "Email guessed from company pattern" : c.why ?? "",
      contactType: /recruit|talent/i.test(c.title) ? "recruiter" : "hiring-manager",
      outreachStatus: "messaged",
      lastTouch: today(),
    });
    updateContact({ email: c.email || undefined, linkedin: c.linkedin || undefined }, { outreachStatus: "messaged", lastTouch: today() });
  } catch {
    /* contacts.tsv is a mirror — never block the send on it */
  }
}

export async function PATCH(req: Request) {
  let body: Patch;
  try {
    body = (await readBoundedJson(req, 64_000)) as Patch;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const record = body.id ? readOutreach(body.id) : null;
  if (!record) return NextResponse.json({ error: "outreach draft not found" }, { status: 404 });
  const now = new Date().toISOString();

  switch (body.action) {
    case "edit": {
      if (typeof body.day === "number") {
        // editing one follow-up, not the first email
        const f = record.followups.find((x) => x.day === body.day);
        if (!f) return NextResponse.json({ error: "follow-up not found" }, { status: 404 });
        if (f.sentAt) return NextResponse.json({ error: "Sent follow-ups are retained. Add a note in Track to correct the record." }, { status: 409 });
        if (typeof body.body === "string") f.body = body.body.slice(0, 3000);
        break;
      }
      if (record.status !== "ready") return NextResponse.json({ error: "Sent messages are retained. Add a note in Track to correct the record." }, { status: 409 });
      if (typeof body.subject === "string") record.subject = body.subject.slice(0, 200);
      if (typeof body.body === "string") record.body = body.body.slice(0, 6000);
      break;
    }
    case "sent": {
      if (body.confirmed !== true) return NextResponse.json({ error: "Confirm you sent the message before recording it." }, { status: 409 });
      if (record.status !== "ready") return NextResponse.json({ error: "This message has already been recorded." }, { status: 409 });
      if (typeof body.subject === "string") record.subject = body.subject.slice(0, 500);
      if (typeof body.body === "string") record.body = body.body.slice(0, 20_000);
      if (typeof body.recipient === "string" && body.recipient.trim()) record.contact.email = body.recipient.trim().slice(0, 500);
      const via = VIAS.includes(body.via as SentVia) ? (body.via as SentVia) : "other";
      record.status = "sent";
      record.sentAt = now;
      record.sentVia = via;
      record.followups = scheduleFollowups(record, now);
      if (record.trackerNum) {
        try {
          const saved = archiveOutreach(careerOpsRoot(), record);
          if (saved) { record.sentAt = saved.at; record.followups = scheduleFollowups(record, saved.at); }
        }
        catch { return NextResponse.json({ error: "Could not archive the sent message. Its sent state was not changed." }, { status: 500 }); }
      }
      logContact(record, via);
      break;
    }
    case "followup-sent": {
      if (body.confirmed !== true) return NextResponse.json({ error: "Confirm you sent the follow-up first." }, { status: 409 });
      const f = record.followups.find((x) => x.day === body.day && !x.sentAt);
      if (!f) return NextResponse.json({ error: "follow-up not found" }, { status: 404 });
      if (typeof body.body === "string") f.body = body.body.slice(0, 20_000);
      f.sentAt = now;
      if (record.trackerNum) {
        try {
          const saved = archiveOutreach(careerOpsRoot(), record, f.day);
          if (saved) f.sentAt = saved.at;
        }
        catch { return NextResponse.json({ error: "Could not archive the follow-up. Its sent state was not changed." }, { status: 500 }); }
      }
      updateContact({ email: record.contact.email || undefined, linkedin: record.contact.linkedin || undefined }, { lastTouch: today() });
      break;
    }
    case "replied":
      record.status = "replied";
      updateContact({ email: record.contact.email || undefined, linkedin: record.contact.linkedin || undefined }, { outreachStatus: "replied", lastTouch: today() });
      break;
    case "dismiss":
      record.status = "dismissed";
      break;
    case "restore":
      record.status = record.sentAt ? "sent" : "ready";
      break;
    case "unsend":
      return NextResponse.json({ error: "Sent records are retained. Add a correction note in Track if a send was recorded by mistake." }, { status: 409 });
    case "use-alternate": {
      const i = typeof body.index === "number" ? body.index : -1;
      const alt = record.alternates[i];
      if (!alt || record.status !== "ready") return NextResponse.json({ error: "alternate not available" }, { status: 400 });
      const prevFirst = record.contact.name.split(/\s+/)[0];
      const nextFirst = alt.name.split(/\s+/)[0];
      record.alternates[i] = record.contact;
      record.contact = alt;
      if (prevFirst && nextFirst) {
        const greet = new RegExp(`^(\\s*(?:hi|hey|hello|dear)\\s+)${prevFirst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        record.body = record.body.replace(greet, `$1${nextFirst}`);
      }
      break;
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  record.updatedAt = now;
  saveOutreach(record);
  return NextResponse.json({ ok: true, item: record });
}
