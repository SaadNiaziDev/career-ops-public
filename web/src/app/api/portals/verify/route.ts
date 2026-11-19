import { detectAts, fetchAts, ATS_LABELS } from "@/lib/search/sources";
import { readPortals } from "@/lib/search/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Health of each tracked company's job feed: live (has postings), empty, broken
// (feed unreachable or moved), or skipped (no supported feed: AI search covers it).
export async function GET() {
  const portals = readPortals();
  const tracked = (portals.tracked_companies ?? []).filter((c) => c.name && c.enabled !== false);
  if (!tracked.length) return Response.json({ available: true, configured: false, companies: [] });
  const results = await Promise.all(tracked.map(async (c) => {
    const found = detectAts(c.api ?? "") ?? detectAts(c.careers_url ?? "");
    if (!found) return { name: c.name!, status: "skipped", detail: "No public job feed · covered by AI search" };
    try {
      const hits = await fetchAts(found.ats, found.slug, c.name!);
      return { name: c.name!, status: hits.length ? "live" : "empty", detail: `${ATS_LABELS[found.ats]} · ${hits.length} open roles` };
    } catch (error) {
      return { name: c.name!, status: "broken", detail: `${ATS_LABELS[found.ats]} · ${error instanceof Error ? error.message : "unreachable"}` };
    }
  }));
  return Response.json({ available: true, configured: true, companies: results });
}
