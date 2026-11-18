import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { careerOpsRoot, doctorState, readApplications, readInbox, trackerCanDelete } from "@/lib/career-ops";
import { scannerSupportsJson } from "@/lib/core/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// STRUCTURAL diagnostics for the in-app bug reporter: shapes, counts and
// capability probes only — never file contents. A malformed tracker shows up
// here as "12 candidate rows, 5 parsed", which is exactly what triage needs,
// without a single company name leaving the machine.

function dirCount(rel: string, ext: string): number {
  try {
    return fs.readdirSync(path.join(careerOpsRoot(), rel)).filter((f) => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

export async function GET() {
  const doctor = doctorState();
  // "candidate" = a line that LOOKS like a row; parsed = what the tolerant
  // reader accepted. A gap between the two is the data-contract fingerprint.
  return Response.json({
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    setup: {
      phase: doctor.phase,
      missing: doctor.missing, // system prereq FILENAMES only (cv.md, portals.yml…)
      hasCv: doctor.hasCv,
      hasData: doctor.hasData,
    },
    data: {
      inbox: readInbox().length,
      tracker: readApplications().length,
      reports: (db().prepare("SELECT COUNT(*) AS c FROM reports").get() as { c: number }).c,
      pdfs: dirCount("output", ".pdf"),
    },
    capabilities: {
      scanJson: scannerSupportsJson(),
      trackerDelete: trackerCanDelete(),
    },
  });
}
