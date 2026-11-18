import { readBoundedJson } from "@/lib/core/request-bounds";
import { BrainError, addSample, deleteSample, fetchProofMeta, githubInfo, readBrain, saveBrain } from "@/lib/brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(e: unknown) {
  if (e instanceof BrainError) return Response.json({ error: e.message }, { status: e.status });
  return Response.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
}

/** GET → Brain state. GET ?github=1 → public repos for the linked GitHub handle. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("github")) {
      const handle = url.searchParams.get("handle") || readBrain().githubHandle;
      return Response.json(await githubInfo(handle));
    }
    return Response.json(readBrain());
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST { action, ... }
 *  - save:          { patch: { proofs?, status?, x?, site?, notes? } } → outreach: block of config/profile.yml
 *  - meta:          { url } → { title, summary } from the page (SSRF-guarded, short timeout)
 *  - add-sample:    { text } → writing-samples/sample-<n>.md + voice-dna.md
 *  - delete-sample: { file }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJson<Record<string, unknown>>(req, 60_000);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "bad json" }, { status: 400 });
  try {
    switch (body.action) {
      case "save":
        return Response.json(saveBrain((body.patch ?? {}) as Record<string, unknown>));
      case "meta":
        return Response.json(await fetchProofMeta(body.url).catch((e) => {
          if (e instanceof BrainError) throw e;
          throw new BrainError("Couldn't read that page. You can still add it and write the summary yourself.", 502);
        }));
      case "add-sample":
        return Response.json(addSample(body.text));
      case "delete-sample":
        return Response.json(deleteSample(body.file));
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}
