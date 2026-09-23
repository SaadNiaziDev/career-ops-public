import { NextResponse } from "next/server";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsRoot } from "@/lib/career-ops";

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
    const { setTrackerStatus } = await import(pathToFileURL(path.join(root, "tracker-mutations.mjs")).href);
    const { resolveTrackerPath } = await import(pathToFileURL(path.join(root, "tracker-utils.mjs")).href);
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
