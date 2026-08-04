"use client";

import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { BetaBanner } from "@/components/beta/beta-banner";
import { NavigationRail } from "@/components/navigation-rail";
import { ScrollProgress } from "@/components/dossier/scroll-progress";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <JobsProvider>
      <PipelineProvider>
        <ApplyProvider>
          <ExploreProvider>
            <ScrollProgress />
            <div className="flex min-h-screen bg-background">
              <NavigationRail />
              <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
              <FirstScoreView />
              <BetaBanner />
            </div>
          </ExploreProvider>
        </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
