import { readWeights, writeWeights } from "@/lib/core/weights";
import { WEIGHT_KEYS, type WeightKey } from "@/lib/weights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(readWeights());
}

export async function POST(req: Request) {
  let body: { weights?: Record<string, unknown> };
  try {
    body = (await req.json()) as { weights?: Record<string, unknown> };
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const raw = body.weights;
  if (!raw || typeof raw !== "object") return Response.json({ error: "no weights" }, { status: 400 });

  const picked: Partial<Record<WeightKey, number>> = {};
  for (const k of WEIGHT_KEYS) {
    const n = Number((raw as Record<string, unknown>)[k]);
    if (Number.isFinite(n) && n >= 0) picked[k] = n;
  }
  if (Object.values(picked).reduce((a, b) => a + (b ?? 0), 0) <= 0) {
    return Response.json({ error: "weights sum to zero" }, { status: 400 });
  }

  try {
    const weights = writeWeights(picked);
    return Response.json({ ok: true, weights, source: "portals" });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
}
