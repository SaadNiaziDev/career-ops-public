import { NextResponse } from "next/server";
import { appendContact, readContacts } from "@/lib/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
