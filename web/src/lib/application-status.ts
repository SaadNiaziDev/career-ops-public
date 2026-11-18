import { createRequire } from "node:module";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { scoreNum } from "@/lib/format";
import { atomicWrite } from "@/lib/core/safe-write";

export class StatusUpdateError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const require = createRequire(path.join(process.cwd(), "package.json"));

export async function updateApplicationStatus(body: { n: string | number; status: string; overrideReason?: string; confirmedSubmission?: boolean }) {
  const { n, status } = body;
  const root = careerOpsRoot();
  const { setTrackerStatus } = require(path.join(root, "tracker-mutations.mjs"));
  const { resolveTrackerPath, loadCanonicalStates, resolveCanonicalState } = require(path.join(root, "tracker-utils.mjs"));
  const { resolveColumns, parseTrackerRow } = require(path.join(root, "tracker-parse.mjs"));
  const fs = require("node:fs");
  const canonical = resolveCanonicalState(status, loadCanonicalStates(path.join(root, "templates/states.yml")));
  if (!canonical) throw new StatusUpdateError("invalid status", 400);
  const trackerPath = resolveTrackerPath(root);
  const lines = fs.readFileSync(trackerPath, "utf8").split("\n");
  const columns = resolveColumns(lines);
  const rows = lines.map((line: string) => parseTrackerRow(line, columns)).filter(Boolean);
  const matches = rows.filter((row: { num: number }) => row.num === Number(n));
  if (matches.length !== 1) throw new StatusUpdateError(matches.length ? "tracker number is ambiguous" : "row not found", matches.length ? 409 : 404);
  if (canonical === "Applied" && body.confirmedSubmission !== true) {
    throw new StatusUpdateError("Confirm that you submitted the application before marking it Applied.", 409);
  }
  const score = scoreNum(String(matches[0].score));
  const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim().replace(/[\r\n]+/g, " ").slice(0, 500) : "";
  if (canonical === "Applied" && Number.isFinite(score) && score < 4 && !overrideReason) {
    throw new StatusUpdateError("This role scored below 4.0; provide an override reason to mark it Applied.", 409);
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
  return { ok: true, status: result.status, historyRecorded };
}
