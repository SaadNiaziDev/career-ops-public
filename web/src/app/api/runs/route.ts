import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read the local worker ledger. Malformed or legacy files are ignored so one
 * interrupted write cannot make the Workers page unavailable. */
export async function GET() {
  const dir = path.join(careerOpsRoot(), ".career-ops-web", "runs");
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).filter((name) => /^[a-z0-9_-]+\.json$/i.test(name));
  } catch {
    return NextResponse.json({ runs: [] });
  }

  const runs = names.flatMap((name) => {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (!value || typeof value !== "object" || typeof value.id !== "string") return [];
      return [value];
    } catch {
      return [];
    }
  });

  runs.sort((a, b) => Number(b.startedAt ?? 0) - Number(a.startedAt ?? 0));
  return NextResponse.json({ runs: runs.slice(0, 80) });
}
