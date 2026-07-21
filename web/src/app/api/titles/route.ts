import { readTitleSuggestions } from "@/lib/titles";
import { readPortalsKeywords } from "@/lib/portals-keywords";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const suggestions = readTitleSuggestions();
  const portals = readPortalsKeywords();
  return Response.json({
    suggestions,
    keywords: portals.positive,
    configured: portals.configured,
  });
}
