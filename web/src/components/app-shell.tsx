"use client";

import { Suspense } from "react";
import { JobsProvider } from "@/components/jobs/job-store";
import { WorkersUiProvider, WorkerSheet, AmbientWorkerBar } from "@/components/jobs/worker-sheet";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { NavigationRail } from "@/components/navigation-rail";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <JobsProvider>
        <WorkersUiProvider>
          <PipelineProvider>
            <ApplyProvider>
              <ToastProvider>
                <Suspense fallback={null}>
                    <div className="flex min-h-screen bg-background">
                      <NavigationRail />
                      <div className="relative flex min-w-0 flex-1 flex-col">
                        <AmbientWorkerBar />
                        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
                      </div>
                      <WorkerSheet />
                    </div>
                </Suspense>
              </ToastProvider>
            </ApplyProvider>
          </PipelineProvider>
        </WorkersUiProvider>
      </JobsProvider>
    </ThemeProvider>
  );
}
