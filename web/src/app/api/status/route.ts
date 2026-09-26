import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

const require = createRequire(path.join(process.cwd(), "package.json"));

export async function POST(req: Request) {
  let body: { n?: string | number; status?: string; overrideReason?: string; confirmedSubmission?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { n, status } = body;
  if (n == null || !String(n).trim() || typeof status !== "string" || !status.trim()) {
    return NextResponse.json({ error: "n and status required" }, { status: 400 });
  }

  const root = careerOpsRoot();
  try {
    const { setTrackerStatus } = require(path.join(root, "tracker-mutations.mjs"));
    const { resolveTrackerPath, loadCanonicalStates, resolveCanonicalState } = require(path.join(root, "tracker-utils.mjs"));
    const { resolveColumns, parseTrackerRow } = require(path.join(root, "tracker-parse.mjs"));
    const fs = require("node:fs");
    const canonical = resolveCanonicalState(status, loadCanonicalStates(path.join(root, "templates/states.yml")));
    if (!canonical) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    const trackerPath = resolveTrackerPath(root);
    const lines = fs.readFileSync(trackerPath, "utf8").split("\n");
    const columns = resolveColumns(lines);
    const rows = lines.map((line: string) => parseTrackerRow(line, columns)).filter(Boolean);
    const matches = rows.filter((row: { num: number }) => row.num === Number(n));
    if (matches.length !== 1) return NextResponse.json({ error: matches.length ? "tracker number is ambiguous" : "row not found" }, { status: matches.length ? 409 : 404 });
    if (canonical === "Applied" && body.confirmedSubmission !== true) {
      return NextResponse.json({ error: "Confirm that you submitted the application before marking it Applied." }, { status: 409 });
    }
    const score = Number.parseFloat(String(matches[0].score).replace(/[^\d.\-]/g, ""));
    const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim().replace(/[\r\n]+/g, " ").slice(0, 500) : "";
    if (canonical === "Applied" && Number.isFinite(score) && score < 4 && !overrideReason) {
      return NextResponse.json({ error: "This role scored below 4.0; provide an override reason to mark it Applied." }, { status: 409 });
    }
    const previous = resolveCanonicalState(matches[0].status, loadCanonicalStates(path.join(root, "templates/states.yml")));
    const result = await setTrackerStatus({
      trackerPath,
      statesPath: path.join(root, "templates/states.yml"),
      selector: String(n),
      status,
      note: canonical === "Applied" && Number.isFinite(score) && score < 4 && overrideReason ? `Below-4.0 apply override: ${overrideReason}` : undefined,
    });
    let historyRecorded = true;
    if (previous && previous !== canonical) {
      try {
        const historyFile = path.join(root, "data/application-stage-history.json");
        const current = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, "utf8")) : [];
        const events = Array.isArray(current) ? current : [];
        events.push({ n: String(n), from: previous, to: canonical, at: new Date().toISOString() });
        atomicWrite(historyFile, `${JSON.stringify(events, null, 2)}\n`);
      } catch {
        historyRecorded = false;
      }
    }
    return NextResponse.json({ ok: true, status: result.status, historyRecorded });
  } catch (error) {
    const failure = error as Error & { code?: string };
    const code = failure.code === "no-tracker" ? 404
      : failure.code === "not-found" ? 404
        : failure.code === "invalid-state" || failure.code === "usage" ? 400
        : failure.code === "ambiguous" ? 409
            : 500;
    if (failure.code === "no-tracker") return NextResponse.json({ error: "tracker not found" }, { status: code });
    if (failure.code === "not-found") return NextResponse.json({ error: "row not found" }, { status: code });
    return NextResponse.json({ error: failure.message || "tracker update failed" }, { status: code });
  }
}
