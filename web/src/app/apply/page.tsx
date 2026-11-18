import { ApplyPageView, type ApplyPageMode } from "@/components/apply/apply-page-view";
import { listOutreach } from "@/lib/outreach";
import { buildKit, buildQueue } from "@/lib/apply/kit-server";

export const dynamic = "force-dynamic";

// /apply            → apply queue (Evaluated, 4.0+, not applied) with kit readiness
// /apply?n=<num>    → the Apply kit for tracker row <num>
// /apply?view=form  → paste any application form URL
export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const n = typeof params.n === "string" ? params.n.trim() : "";
  const mode: ApplyPageMode = params.view === "email" ? "email" : params.view === "form" ? "form" : n ? "kit" : "queue";
  const kit = mode === "kit" && /^\d{1,6}$/.test(n) ? buildKit(n) : null;
  const queue = mode === "queue" ? buildQueue() : [];
  return <ApplyPageView mode={mode} n={n} kit={kit} queue={queue} emails={mode === "email" ? listOutreach() : []} />;
}
