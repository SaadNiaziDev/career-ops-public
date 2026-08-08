"use client";

import { Suspense } from "react";
import { JobsProvider } from "@/components/jobs/job-store";
import { WorkersUiProvider, WorkerSheet, AmbientWorkerBar } from "@/components/jobs/worker-sheet";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { BetaBanner } from "@/components/beta/beta-banner";
import { NavigationRail } from "@/components/navigation-rail";
import { MobileNav } from "@/components/mobile-nav";
import { ScrollProgress } from "@/components/dossier/scroll-progress";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CommandPaletteHost } from "@/components/command-palette-host";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <JobsProvider>
        <WorkersUiProvider>
          <PipelineProvider>
            <ApplyProvider>
              <ToastProvider>
                {/* ExploreProvider reads useSearchParams — Next requires a Suspense boundary. */}
                <Suspense fallback={null}>
                  <ExploreProvider>
                    <ScrollProgress />
                    <MobileNav />
                    <div className="flex min-h-screen bg-background">
                      <NavigationRail />
                      <div className="relative flex min-w-0 flex-1 flex-col">
                        <AmbientWorkerBar />
                        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
                      </div>
                      <WorkerSheet />
                      <FirstScoreView />
                      <BetaBanner />
                    </div>
                    <CommandPaletteHost />
                  </ExploreProvider>
                </Suspense>
              </ToastProvider>
            </ApplyProvider>
          </PipelineProvider>
        </WorkersUiProvider>
      </JobsProvider>
    </ThemeProvider>
  );
}
