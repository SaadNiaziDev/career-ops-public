import { NextResponse } from "next/server";
import { appendContact, readContacts, updateContact, type OutreachStatus } from "@/lib/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: OutreachStatus[] = ["not-contacted", "messaged", "replied", "ghosted"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tracker = url.searchParams.get("tracker") ?? undefined;
  let rows = readContacts();
  if (tracker) rows = rows.filter((r) => r.trackerNum === tracker);
  return NextResponse.json({ contacts: rows });
}

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const trackerNum = (body.trackerNum ?? body["tracker#"] ?? "").trim();
  const company = (body.company ?? "").trim();
  if (!trackerNum || !company) {
    return NextResponse.json({ error: "trackerNum and company required" }, { status: 400 });
  }
  try {
    appendContact({
      trackerNum,
      company,
      role: (body.role ?? "").trim(),
      name: (body.name ?? "").trim(),
      title: (body.title ?? "").trim(),
      channel: (body.channel ?? "email").trim(),
      email: (body.email ?? "").trim(),
      linkedin: (body.linkedin ?? "").trim(),
      verified: (body.verified ?? "unverified").trim(),
      source: (body.source ?? "manual").trim(),
      notes: (body.notes ?? "").trim(),
      contactType: (body.contact_type ?? body.contactType ?? "") as never,
      outreachStatus: (body.outreach_status ?? body.outreachStatus ?? "not-contacted") as never,
      lastTouch: (body.last_touch ?? body.lastTouch ?? "").trim(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const statusRaw = (body.outreach_status ?? body.outreachStatus ?? "").trim();
  if (statusRaw && !VALID_STATUS.includes(statusRaw as OutreachStatus)) {
    return NextResponse.json({ error: "invalid outreach_status" }, { status: 400 });
  }
  const status = (statusRaw || undefined) as OutreachStatus | undefined;
  const ok = updateContact(
    {
      email: (body.email ?? "").trim() || undefined,
      linkedin: (body.linkedin ?? "").trim() || undefined,
      trackerNum: (body.trackerNum ?? "").trim() || undefined,
      name: (body.name ?? "").trim() || undefined,
    },
    {
      outreachStatus: status,
      lastTouch: (body.last_touch ?? body.lastTouch ?? new Date().toISOString().slice(0, 10)).trim(),
      contactType: (body.contact_type ?? body.contactType ?? undefined) as never,
      notes: body.notes?.trim(),
      verified: body.verified?.trim(),
    },
  );
  if (!ok) return NextResponse.json({ error: "contact not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
