import { KEY_SPECS, probeKey, readKeyStatuses, writeKey, type KeyId } from "@/lib/core/env-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isKeyId(v: unknown): v is KeyId {
  return typeof v === "string" && KEY_SPECS.some((s) => s.id === v);
}

/** Status only — a stored key is never echoed back (blueprint S13 · redline 3). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const check = url.searchParams.get("check");
  const keys = readKeyStatuses();

  if (isKeyId(check)) {
    const probe = await probeKey(check);
    return Response.json({ keys, probe: { id: check, ...probe } });
  }
  return Response.json({ keys });
}

export async function POST(req: Request) {
  let body: { id?: unknown; value?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; value?: unknown };
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!isKeyId(body.id)) return Response.json({ error: "unknown key" }, { status: 400 });
  const value = typeof body.value === "string" ? body.value : "";

  try {
    writeKey(body.id, value);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }

  const probe = value.trim() ? await probeKey(body.id) : { state: "unknown" as const, detail: "cleared" };
  return Response.json({ ok: true, keys: readKeyStatuses(), probe: { id: body.id, ...probe } });
}
