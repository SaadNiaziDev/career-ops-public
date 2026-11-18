import { NextResponse } from "next/server";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";
import { readBoundedJson, RequestTooLargeError } from "@/lib/core/request-bounds";
import { validateActivityInput } from "@/lib/application-activity-shared";
import { scoreNum } from "@/lib/format";
import { saveActivity } from "@/lib/application-activity-store";
import { loadApplicationRecords } from "@/lib/application-records";
import { updateApplicationStatus } from "@/lib/application-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const n = new URL(request.url).searchParams.get("n");
  if (!n || !/^[1-9]\d{0,5}$/.test(n)) return NextResponse.json({ error: "Application number required." }, { status: 400 });
  const record = loadApplicationRecords().find((item) => item.app.n === n);
  return record ? NextResponse.json(record) : NextResponse.json({ error: "Application not found." }, { status: 404 });
}

export async function POST(request: Request) {
  let input;
  try { input = validateActivityInput(await readBoundedJson(request, 32_000)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid activity." }, { status: error instanceof RequestTooLargeError ? 413 : 400 }); }
  const matches = readApplications().filter((app) => app.n === input.n);
  if (matches.length !== 1) return NextResponse.json({ error: matches.length ? "Application number is ambiguous." : "Application not found." }, { status: matches.length ? 409 : 404 });
  if (input.kind === "application" && scoreNum(matches[0].score) < 4 && !input.overrideReason) {
    return NextResponse.json({ error: "This role scored below 4.0. Add a specific reason before recording the application." }, { status: 409 });
  }
  const { confirmed: _confirmed, occurredAt, overrideReason, ...details } = input;
  try {
    const event = saveActivity(careerOpsRoot(), { ...details, at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString() });
    let warning: string | undefined;
    let status = matches[0].status;
    if (input.kind === "application" && /^(Evaluated|SKIP|Discarded)$/i.test(matches[0].status)) {
      try {
        const result = await updateApplicationStatus({ n: input.n, status: "Applied", confirmedSubmission: true, overrideReason });
        status = result.status;
      } catch { warning = "The submission is saved, but its tracker status could not be updated. Update the status from the application record."; }
    }
    return NextResponse.json({ ok: true, event, warning, status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save activity." }, { status: 500 });
  }
}
