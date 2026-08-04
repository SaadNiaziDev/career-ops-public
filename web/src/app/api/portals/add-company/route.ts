import { appendPortalsCompany } from "@/lib/portals-keywords";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { name?: string; careers_url?: string; api?: string; notes?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const careersUrl = String(body.careers_url ?? "").trim();
  if (!name) return Response.json({ error: "company name required" }, { status: 400 });
  if (!careersUrl) return Response.json({ error: "careers URL required" }, { status: 400 });
  try {
    new URL(careersUrl);
  } catch {
    return Response.json({ error: "careers URL is not a valid URL" }, { status: 400 });
  }
  const api = String(body.api ?? "").trim();
  if (api) {
    try {
      new URL(api);
    } catch {
      return Response.json({ error: "ATS URL is not a valid URL" }, { status: 400 });
    }
  }

  try {
    const result = appendPortalsCompany({ name, careers_url: careersUrl, api, notes: String(body.notes ?? "").trim() });
    if (!result.added) return Response.json({ error: `"${name}" is already tracked` }, { status: 409 });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
}
