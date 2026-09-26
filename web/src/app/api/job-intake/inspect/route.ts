import { pipelineSummary, doctorState } from "@/lib/career-ops";
import { checkOffersLiveness } from "@/lib/core/liveness";
import { validatePublicUrl } from "@/lib/public-url-policy";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: Request) {
  let body: { url?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (typeof body.url !== "string" || body.url.length > 8_000) {
    return Response.json({ error: "Paste one job URL to check." }, { status: 400 });
  }
  let url: string;
  try {
    url = new URL(body.url.trim()).href;
    await validatePublicUrl(url);
  } catch {
    return Response.json({ error: "Enter a valid public HTTP(S) job URL." }, { status: 400 });
  }

  const key = normalizeVacancyUrl(url) ?? url;
  const pipeline = pipelineSummary();
  const inbox = pipeline.inbox.find((job) => (normalizeVacancyUrl(job.url) ?? job.url) === key);
  const application = pipeline.applications.find((job) => job.url && (normalizeVacancyUrl(job.url) ?? job.url) === key);
  const existing = application
    ? { kind: "application", href: `/pipeline/${application.n}`, label: `Open application #${application.n}` }
    : inbox ? { kind: "inbox", href: "/pipeline?tab=INBOX", label: "Open pipeline inbox" } : null;
  const liveness = existing ? null : (await checkOffersLiveness([url]))[0] ?? { url, result: "uncertain" as const, reason: "No verification result", via: "none" as const };
  return Response.json({
    url,
    liveness,
    existing,
    hasCv: doctorState().hasCv,
    recommendation: existing ? "open-existing" : liveness?.result === "active" ? "evaluate" : "open-posting",
  });
}
