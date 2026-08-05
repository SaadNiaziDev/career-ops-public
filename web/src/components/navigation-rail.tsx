"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { CoMark } from "@/components/co-mark";
import { NAV_ITEMS, isActivePath } from "@/lib/nav-items";
import { useJobs } from "@/components/jobs/job-store";
import { useWorkersUi } from "@/components/jobs/worker-sheet";

export function NavigationRail() {
  const pathname = usePathname();
  const { jobs } = useJobs();
  const { open, toggle } = useWorkersUi();
  const running = jobs.filter((j) => j.status === "running").length;

  return (
    <nav className="md3-rail sticky top-0 h-screen shrink-0" aria-label="Primary">
      <Link href="/" className="md3-rail-mark" aria-label="career-ops home">
        <CoMark size={28} />
      </Link>
      <div className="md3-rail-scroll">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = isActivePath(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className="md3-rail-item"
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
            >
              <span className="md3-rail-pill">
                <MaterialSymbol
                  name={icon}
                  filled={active}
                  size={24}
                  className={active ? "text-[var(--md-sys-color-on-secondary-container)]" : "text-[var(--md-sys-color-on-surface-variant)]"}
                />
              </span>
              <span className="md3-rail-label">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="md3-rail-footer">
        <div className="md3-rail-divider" role="separator" />
        <button
          type="button"
          className="md3-rail-item"
          data-active={open ? "true" : "false"}
          aria-pressed={open}
          aria-label={running > 0 ? `Workers, ${running} running` : "Workers"}
          onClick={toggle}
        >
          <span className="md3-rail-pill relative">
            <MaterialSymbol
              name={running > 0 ? "progress_activity" : "manufacturing"}
              filled={open}
              size={24}
              className={
                running > 0
                  ? "animate-spin text-[var(--md-sys-color-primary)]"
                  : open
                    ? "text-[var(--md-sys-color-on-secondary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)]"
              }
            />
            {running > 0 && (
              <span className="md3-rail-badge" aria-hidden>
                {running > 9 ? "9+" : running}
              </span>
            )}
          </span>
          <span className="md3-rail-label">Workers</span>
        </button>
      </div>
    </nav>
  );
}
