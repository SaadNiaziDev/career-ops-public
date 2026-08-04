"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DossierHero({
  eyebrow,
  title,
  description,
  actions,
  footer,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-5 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] p-6 sm:mb-6 sm:p-8",
        className,
      )}
    >
      <p className="md-eyebrow">{eyebrow}</p>
      <h1 className="md-display-small-emphasized mt-3 max-w-2xl text-[var(--md-sys-color-on-surface)]">{title}</h1>
      {description && (
        <p className="mt-3 mb-0 max-w-xl md-body-large text-[var(--md-sys-color-on-surface-variant)]">{description}</p>
      )}
      {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
      {footer && <div className="mt-5 border-t border-[var(--md-sys-color-outline-variant)] pt-5">{footer}</div>}
    </section>
  );
}
