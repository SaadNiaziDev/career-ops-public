import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

const require = createRequire(path.join(process.cwd(), "package.json"));

export async function POST(req: Request) {
  let body: { n?: string | number; status?: string };
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
    const { resolveTrackerPath } = require(path.join(root, "tracker-utils.mjs"));
    const result = await setTrackerStatus({
      trackerPath: resolveTrackerPath(root),
      statesPath: path.join(root, "templates/states.yml"),
      selector: String(n),
      status,
    });
    return NextResponse.json({ ok: true, status: result.status });
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
