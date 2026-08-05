import { checkOffersLiveness } from "@/lib/core/liveness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** POST { urls: string[] } → { results: OfferLiveness[] }
 *  Used by Explore → AI search to drop expired postings before they reach the UI. */
export async function POST(req: Request) {
  let body: { urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string").slice(0, 20)
    : [];
  if (urls.length === 0) return Response.json({ results: [] });

  const results = await checkOffersLiveness(urls);
  return Response.json({ results });
}
