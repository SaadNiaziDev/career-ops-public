import { NextResponse } from "next/server";
import { updateApplicationStatus, StatusUpdateError } from "@/lib/application-status";

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

  try {
    const result = await updateApplicationStatus({ ...body, n, status });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatusUpdateError) return NextResponse.json({ error: error.message }, { status: error.status });
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
