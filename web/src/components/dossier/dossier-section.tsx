"use client";

import type { ReactNode } from "react";
import { Md3Card } from "@/components/ui/md3-card";

export function DossierSection({
  icon,
  title,
  hint,
  extra,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Md3Card
      className={className}
      title={
        <span className="inline-flex items-center gap-2.5 md-title-medium text-[var(--md-sys-color-on-surface)]">
          {icon}
          {title}
        </span>
      }
      extra={
        extra ??
        (hint ? (
          <span className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">{hint}</span>
        ) : undefined)
      }
    >
      <div className="dossier-inset-stack -mt-2">{children}</div>
    </Md3Card>
  );
}
