import { getSession } from "@/lib/apply/session";
import { fillSession, handoffSession } from "@/lib/apply/fill";
import { resolveIndexedCv, resolveTailoredCv, companyFromTitle } from "@/lib/apply/cv";
import { findApplication } from "@/lib/career-ops";
import type { ApplyField } from "@/lib/apply/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Fill the real form behind the scenes (headed-but-off-screen), screenshotting
// each step for the "behind the scenes" strip, then bring the window to the front
// so the HUMAN reviews and submits. NEVER submits — there is no submit path here.
export async function POST(req: Request) {
  let body: { sessionId?: string; answers?: Record<string, string>; fields?: ApplyField[]; handoff?: boolean; company?: string; trackerNum?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { sessionId, answers = {}, fields = [], handoff, company, trackerNum } = body;
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  // Resolve the tailored CV server-side (never trust a client path): by the
  // offer's company if known, else best-effort from the form title.
  const session = getSession(sessionId);
  // Prefer the CV indexed for this exact tracker row's report.
  const reportNum = trackerNum && /^\d+$/.test(trackerNum) ? findApplication(trackerNum)?.report.match(/\[(\d+)\]/)?.[1] ?? trackerNum : null;
  const cvPath = resolveIndexedCv(reportNum) ?? resolveTailoredCv(company) ?? resolveTailoredCv(companyFromTitle(session?.title)) ?? undefined;

  try {
    const result = await fillSession(sessionId, answers, fields, cvPath);
    if (handoff) await handoffSession(sessionId).catch(() => {});
    return Response.json({ ...result, handedOff: !!handoff, cvAttached: !!cvPath });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 200) : "fill failed" }, { status: 500 });
  }
}
