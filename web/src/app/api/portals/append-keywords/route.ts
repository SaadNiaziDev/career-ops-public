import { appendPortalsKeywords } from "@/lib/portals-keywords";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { keywords?: string[] };
  try {
    body = (await req.json()) as { keywords?: string[] };
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const keywords = (Array.isArray(body.keywords) ? body.keywords : []).map((k) => String(k).trim()).filter(Boolean);
  if (keywords.length === 0) return Response.json({ error: "no keywords" }, { status: 400 });

  try {
    const result = appendPortalsKeywords(keywords);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
}
