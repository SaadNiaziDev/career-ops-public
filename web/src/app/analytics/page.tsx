import { pipelineSummary, dimensionTrends, readApplicationStageHistory, readRankingSignals } from "@/lib/career-ops";
import { AnalyticsView } from "@/components/analytics-view";

export const dynamic = "force-dynamic";

export default function Analytics() {
  const { applications, inbox } = pipelineSummary();
  const trends = dimensionTrends(applications);
  const signals = readRankingSignals();
  return <AnalyticsView applications={applications} inbox={inbox} stageHistory={readApplicationStageHistory()} dimensionTrends={trends} rankingSignals={signals} />;
}
