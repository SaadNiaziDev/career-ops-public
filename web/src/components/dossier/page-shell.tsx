import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Canonical page widths — every route uses exactly one of these.
 *
 * | Token     | Max     | Routes |
 * |-----------|---------|--------|
 * | narrow    | 48rem   | add, config, apply, jobs/[id], first-run home |
 * | default   | 72rem   | today, explore, CV, contacts, analytics, portals, jobs |
 * | wide      | 80rem   | pipeline list, pipeline report |
 */
export type PageWidth = "narrow" | "default" | "wide";

const WIDTH_CLASS: Record<PageWidth, string> = {
  narrow: "page-width-narrow",
  default: "page-width-default",
  wide: "page-width-wide",
};

/** Canonical page container — shared horizontal rhythm + mobile bottom clearance. */
export function PageShell({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return (
    <div className={cn("page-shell dossier-page", WIDTH_CLASS[width], className)}>
      {children}
    </div>
  );
}
