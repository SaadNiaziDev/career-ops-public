import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageWidth = "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";

const WIDTH: Record<PageWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  full: "max-w-none",
};

/** Canonical page container — shared horizontal rhythm + mobile bottom clearance. */
export function PageShell({
  children,
  width = "6xl",
  className,
}: {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return (
    <div className={cn("page-shell dossier-page", WIDTH[width], className)}>
      {children}
    </div>
  );
}
