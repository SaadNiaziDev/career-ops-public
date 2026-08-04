"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DossierPageHeader({
  title,
  description,
  extra,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("dossier-page-header flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="md-display-small-emphasized mb-1 text-[var(--md-sys-color-on-surface)]">{title}</h1>
        {description != null && (
          <p className="mb-0 max-w-2xl md-body-large text-[var(--md-sys-color-on-surface-variant)]">{description}</p>
        )}
      </div>
      {extra != null && <div className="shrink-0">{extra}</div>}
    </div>
  );
}
