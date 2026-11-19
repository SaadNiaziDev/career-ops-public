import { ApplyPageView, type ApplyPageMode } from "@/components/apply/apply-page-view";
import { buildKit, buildQueue } from "@/lib/apply/kit-server";
import { readReport } from "@/lib/career-ops";
import { parseMachineSummary } from "@/lib/format";

export const dynamic = "force-dynamic";

// /apply            → roles to apply to (evaluated, not applied)
// /apply?n=<num>    → the workspace for one role
// /apply?view=form  → fill any application form
export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const n = typeof params.n === "string" ? params.n.trim() : "";
  const mode: ApplyPageMode = params.view === "form" ? "form" : n ? "kit" : "queue";
  const kit = mode === "kit" && /^\d{1,6}$/.test(n) ? buildKit(n) : null;
  const report = kit ? readReport(n) : null;
  return <ApplyPageView mode={mode} n={n} kit={kit} queue={mode === "queue" ? buildQueue(0) : []} summary={report ? parseMachineSummary(report.content) : null} />;
}
