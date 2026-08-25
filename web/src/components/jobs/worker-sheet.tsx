"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useJobs } from "@/components/jobs/job-store";
import { WorkerCard } from "@/components/jobs/worker-card";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { jobDestinationHref, resolveReportNum } from "@/components/jobs/job-utils";

type WorkersUiCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const WorkersUiContext = createContext<WorkersUiCtx | null>(null);

export function useWorkersUi() {
  const c = useContext(WorkersUiContext);
  if (!c) throw new Error("useWorkersUi must be used within <WorkersUiProvider>");
  return c;
}

export function WorkersUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return <WorkersUiContext.Provider value={{ open, setOpen, toggle }}>{children}</WorkersUiContext.Provider>;
}

/** Shared worker card list — used by the desktop sheet and the mobile drawer. */
export function WorkerTray({ className }: { className?: string }) {
  const { jobs, removeJob, clearFinished } = useJobs();
  const { applications } = usePipeline();
  const pathname = usePathname();
  if (jobs.length === 0) {
    return (
      <div className={cn("px-1 py-3 md-body-small text-[var(--md-sys-color-on-surface-variant)]", className)}>
        No workers yet. Start an evaluation to see progress here.
      </div>
    );
  }
  const running = jobs.filter((j) => j.status === "running").length;
  const finished = jobs.length - running;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="md-label-small font-semibold uppercase tracking-[0.14em] text-[var(--md-sys-color-outline)]">
          Workers
        </span>
        {running > 0 && (
          <span className="md-label-small tabular-nums text-[var(--md-sys-color-primary)]">{running} running</span>
        )}
        <Link
          href="/jobs"
          className="ml-auto text-[var(--md-sys-color-outline)] transition-colors hover:text-[var(--md-sys-color-on-surface)]"
          title="History"
          aria-label="Worker history"
        >
          <MaterialSymbol name="history" size={16} />
        </Link>
        {finished > 0 && (
          <button
            type="button"
            onClick={clearFinished}
            className="md-label-small text-[var(--md-sys-color-outline)] transition-colors hover:text-[var(--md-sys-color-on-surface)]"
            title="Clear finished"
          >
            clear
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {jobs.slice(0, 6).map((j) => {
          const dest = jobDestinationHref(j, applications);
          const reportN = resolveReportNum(j, applications);
          const active = pathname === `/jobs/${j.id}` || (reportN != null && pathname === `/pipeline/${reportN}`);
          return (
            <li key={j.id}>
              <Link
                href={dest}
                className={cn(
                  "group block rounded-[var(--md-sys-shape-corner-medium)] border px-2.5 py-2 transition-colors",
                  active
                    ? "border-[var(--md-sys-color-primary)]/40 bg-[var(--md-sys-color-secondary-container)]"
                    : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] hover:bg-[var(--md-sys-color-surface-container-high)]",
                )}
              >
                <WorkerCard
                  job={j}
                  variant="tray"
                  trailing={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        removeJob(j.id);
                      }}
                      className="text-[var(--md-sys-color-outline)] opacity-0 transition-opacity hover:text-[var(--md-sys-color-on-surface)] group-hover:opacity-100"
                      aria-label="Dismiss job"
                    >
                      <MaterialSymbol name="close" size={14} />
                    </button>
                  }
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 400px MD3 side sheet — docked beside main on desktop. */
export function WorkerSheet() {
  const { open, setOpen } = useWorkersUi();
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === "running").length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      <div
        className={cn("md3-worker-scrim xl:hidden", open && "open")}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={cn("md3-worker-sheet", open && "open")}
        aria-label="Workers"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex h-full w-[min(400px,86vw)] flex-col xl:w-[400px]">
          <div className="flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3">
            <MaterialSymbol
              name={running > 0 ? "progress_activity" : "manufacturing"}
              size={22}
              className={cn(
                running > 0 && "animate-spin text-[var(--md-sys-color-primary)]",
                running === 0 && "text-[var(--md-sys-color-on-surface-variant)]",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="md-title-small text-[var(--md-sys-color-on-surface)]">Workers</div>
              <div className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">
                {running > 0 ? `${running} running` : jobs.length > 0 ? `${jobs.length} recent` : "Idle"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close workers"
              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--md-sys-shape-corner-full)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
            >
              <MaterialSymbol name="close" size={22} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" data-lenis-prevent>
            <WorkerTray />
          </div>
          <div className="border-t border-[var(--md-sys-color-outline-variant)] px-4 py-3">
            <Link
              href="/jobs"
              onClick={() => setOpen(false)}
              className="md3-btn-text w-full justify-center"
            >
              <MaterialSymbol name="history" size={18} />
              Full history
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

/** 4px ambient signal at the top of the content pane while workers run and the sheet is shut. */
export function AmbientWorkerBar() {
  const { open, setOpen } = useWorkersUi();
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === "running").length;
  if (running === 0 || open) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="md3-worker-ambient"
      aria-label={`${running} worker${running === 1 ? "" : "s"} running — open Workers`}
      title={`${running} running — open Workers`}
    >
      <span className="job-indeterminate block h-full w-full" />
    </button>
  );
}
