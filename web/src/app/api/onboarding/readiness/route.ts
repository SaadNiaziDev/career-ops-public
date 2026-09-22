import { runReadiness, writeOnboardingStatus } from "@/lib/onboarding/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let cliId = "";
  try {
    const body = await req.json() as { cliId?: unknown };
    cliId = typeof body.cliId === "string" ? body.cliId.trim() : "";
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const result = await runReadiness(cliId);
  writeOnboardingStatus(result);
  return Response.json(result, { status: result.ready ? 200 : 422 });
}
