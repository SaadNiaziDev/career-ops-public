import { NextResponse } from "next/server";
import { detectClis } from "@/lib/clis";
import { getKv, setKv } from "@/lib/db";

export const dynamic = "force-dynamic";

// Installed AI engines and the one this machine uses (saved in the local database,
// so every browser and tab agrees). Falls back to the first installed engine.
export async function GET() {
  const clis = detectClis();
  const saved = getKv("ai.engine");
  const selected = clis.find((c) => c.id === saved && c.installed)?.id ?? clis.find((c) => c.installed)?.id ?? null;
  return NextResponse.json({ clis, selected, saved: clis.some((c) => c.id === saved && c.installed) });
}

export async function POST(req: Request) {
  let body: { cliId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const cliId = typeof body.cliId === "string" ? body.cliId : "";
  if (!detectClis().some((c) => c.id === cliId && c.installed)) return NextResponse.json({ error: "That AI engine is not installed." }, { status: 400 });
  setKv("ai.engine", cliId);
  return NextResponse.json({ ok: true, selected: cliId });
}
