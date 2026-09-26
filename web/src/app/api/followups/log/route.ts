import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { updateContact } from "@/lib/contacts";
import { atomicWrite } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Append-only follow-up log → data/follow-ups.md (NEVER clobber; the cadence
// calculator reads this to advance the schedule). Mirrors how the CLI records a
// follow-up. One dated line per logged follow-up.
export async function POST(req: Request) {
  let body: { num?: string | number; company?: string; note?: string; channel?: string; contactName?: string; contactEmail?: string; sentAt?: string };
  try {
    body = (await req.json()) as { num?: string | number; company?: string; note?: string };
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const company = (body.company || "").toString().trim();
  if (!company) return Response.json({ error: "company required" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const numValue = body.num == null ? "" : String(body.num).trim();
  if (!/^\d+$/.test(numValue)) return Response.json({ error: "application number required" }, { status: 400 });
  const sentAt = typeof body.sentAt === "string" ? Date.parse(body.sentAt) : Number.NaN;
  if (!Number.isFinite(sentAt) || sentAt > Date.now() + 60_000 || sentAt < Date.now() - 15 * 60_000) {
    return Response.json({ error: "Confirm the message was sent before recording it." }, { status: 400 });
  }
  const channel = (body.channel || "manual").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
  const contactName = (body.contactName || "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);
  const contactEmail = (body.contactEmail || "").replace(/[\r\n]+/g, " ").trim().slice(0, 254);
  const note = (body.note || "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  const num = `#${numValue} `;
  const details = [`Sent via ${channel || "manual"}`, contactName && `to ${contactName}`, contactEmail && `<${contactEmail}>`, note].filter(Boolean).join(" · ");
  const line = `- ${today} · ${num}${company} — ${details}\n`;

  const file = path.join(careerOpsRoot(), "data", "follow-ups.md");
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, "# Follow-ups\n\n", "utf8");
    const previous = fs.readFileSync(file, "utf8");
    if (previous.split(/\r?\n/).some((existing) => existing.startsWith(`- ${today} · ${num}${company} —`))) {
      return Response.json({ error: "A follow-up is already recorded for this application today." }, { status: 409 });
    }
    atomicWrite(file, `${previous}${previous.endsWith("\n") ? "" : "\n"}${line}`);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
  let contactUpdated = true;
  if (contactEmail || contactName) {
    try {
      contactUpdated = updateContact(
        { email: contactEmail || undefined, trackerNum: numValue, name: contactName || undefined },
        { outreachStatus: "messaged", lastTouch: today },
      );
    } catch {
      contactUpdated = false;
    }
  }
  return Response.json({ ok: true, contactUpdated });
}
