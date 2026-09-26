import { execFile } from "node:child_process";
import fs from "node:fs";
import { careerOpsRoot, rootScript, pipelineSummary } from "@/lib/career-ops";
import { sortFollowups } from "@/lib/list-sort-policy";
import { atomicWrite } from "@/lib/core/safe-write";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The DEMAND loop: surface follow-ups due, via the core's own
// followup-cadence.mjs --json (the SAME calculator the CLI uses) — we never
// reimplement the cadence logic, we read its verdict (mirrors /api/doctor).
export async function GET() {
  const script = rootScript("followup-cadence");
  if (!fs.existsSync(script)) return Response.json({ available: false, metadata: null, entries: [] });
  const stdout = await new Promise<string>((resolve) => {
    execFile("node", [script, "--json"], { cwd: careerOpsRoot(), timeout: 12_000 }, (_e, out) => resolve(out || ""));
  });
  try {
    const start = stdout.indexOf("{");
    const j = JSON.parse(stdout.slice(start));
    type Entry = { urgency?: string; status?: string; nextFollowupDate?: string; company?: string; num?: number; snoozedUntil?: string; snoozeReason?: string };
    const entries = sortFollowups<Entry>(Array.isArray(j.entries) ? j.entries : []);
    const snoozes = readSnoozes();
    const today = new Date().toISOString().slice(0, 10);
    const snoozed = Object.entries(snoozes)
      .filter(([, item]) => item && typeof item.until === "string" && item.until >= today)
      .map(([num, item]) => ({ num: Number(num), company: item.company, snoozedUntil: item.until, snoozeReason: item.reason }));
    // Overdue first; cap for the home (full list lives in the tracker).
    const active = entries.filter((entry) => {
      const item = snoozes[String(entry.num)];
      return !item || typeof item.until !== "string" || item.until < today;
    });
    const overdue = active.filter((e) => /overdue|urgent/i.test(String(e.urgency))).slice(0, 8);
    const top = (overdue.length ? overdue : active).slice(0, 6);
    return Response.json({ available: true, metadata: j.metadata ?? null, entries: top, snoozed });
  } catch {
    return Response.json({ available: false, metadata: null, entries: [] });
  }
}

type Snooze = { until: string; reason: string; company: string };
function snoozeFile() { return path.join(careerOpsRoot(), "data/follow-up-snoozes.json"); }
function readSnoozes(): Record<string, Snooze> {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(snoozeFile(), "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Snooze> : {};
  } catch { return {}; }
}

export async function POST(req: Request) {
  let body: { num?: unknown; until?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const num = String(body.num ?? "");
  const until = typeof body.until === "string" ? body.until : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const today = new Date().toISOString().slice(0, 10);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(until) ? new Date(`${until}T00:00:00Z`) : null;
  if (!/^\d+$/.test(num) || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== until || until <= today || !reason || reason.length > 300) {
    return Response.json({ error: "Choose a future return date and give a short reason." }, { status: 400 });
  }
  const application = pipelineSummary().applications.find((item) => item.n === num);
  if (!application) return Response.json({ error: "That application is no longer in the tracker." }, { status: 404 });
  const snoozes = readSnoozes();
  snoozes[num] = { until, reason, company: application.company };
  atomicWrite(snoozeFile(), `${JSON.stringify(snoozes, null, 2)}\n`);
  return Response.json({ ok: true, until, reason });
}
