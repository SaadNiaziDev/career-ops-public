"use client";

import Link from "next/link";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { CoMark } from "@/components/shell/co-mark";
import { NavigationLinks } from "@/components/shell/navigation-links";
import { UsageMeter } from "@/components/shell/usage-meter";
import { useJobs } from "@/components/jobs/job-store";
import { useWorkersUi } from "@/components/jobs/worker-sheet";

/** Desktop sidebar: brand, the five destinations, and AI activity at the bottom. */
export function NavigationRail() {
  const { jobs } = useJobs();
  const { open, toggle } = useWorkersUi();
  const running = jobs.filter((j) => j.status === "running").length;

  return (
    <nav className="app-sidebar" aria-label="Primary">
      <Link href="/" className="app-sidebar-brand" aria-label="career-ops home">
        <CoMark size={30} />
        <span>career-ops</span>
      </Link>

      <NavigationLinks layout="sidebar" />

      <div className="app-sidebar-footer">
        <button
          type="button"
          className="app-nav-link"
          data-active={open ? "true" : "false"}
          aria-pressed={open}
          onClick={toggle}
        >
          <span className="app-nav-icon">
            <MaterialSymbol
              name={running > 0 ? "progress_activity" : "manufacturing"}
              filled={open}
              size={22}
              className={running > 0 ? "animate-spin text-[var(--md-sys-color-primary)]" : undefined}
            />
          </span>
          <span className="app-nav-label">AI activity</span>
          {running > 0 && <span className="app-sidebar-count">{running > 9 ? "9+" : running}</span>}
        </button>
        <div className="app-sidebar-usage">
          <UsageMeter />
        </div>
      </div>
    </nav>
  );
}
