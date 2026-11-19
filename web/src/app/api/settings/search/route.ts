import { addCompany, readSearchSettings, updateCompany, updateSearchSettings, type SearchSettingsPatch } from "@/lib/search/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: unknown, status = 400) => Response.json({ error: error instanceof Error ? error.message : "Could not save." }, { status });

export async function GET() {
  return Response.json(readSearchSettings());
}

/** Update titles, locations, posting age and job boards. */
export async function PUT(req: Request) {
  try { return Response.json(updateSearchSettings((await req.json()) as SearchSettingsPatch)); }
  catch (error) { return fail(error); }
}

/** Company list: { action: "add", name, url } | { action: "toggle", name, enabled } | { action: "remove", name } */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: string; name?: string; url?: string; enabled?: boolean };
    const name = String(body.name ?? "");
    if (body.action === "add") return Response.json(addCompany(name, String(body.url ?? "")));
    if (body.action === "toggle") return Response.json(updateCompany(name, { enabled: !!body.enabled }));
    if (body.action === "remove") return Response.json(updateCompany(name, { remove: true }));
    return fail(new Error("Unknown action."));
  } catch (error) {
    return fail(error);
  }
}
