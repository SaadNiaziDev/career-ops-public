import { pipelineSummary, dimensionTrends, readRankingSignals } from "@/lib/career-ops";
import { AnalyticsView } from "@/components/analytics-view";

export const dynamic = "force-dynamic";

export default function Analytics() {
  const { applications } = pipelineSummary();
  const trends = dimensionTrends(applications);
  const signals = readRankingSignals();
  return <AnalyticsView applications={applications} dimensionTrends={trends} rankingSignals={signals} />;
}
