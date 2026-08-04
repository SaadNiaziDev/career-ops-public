"use client";

import type { ReactNode } from "react";
import { Md3Card } from "@/components/ui/md3-card";
import { cn } from "@/lib/cn";

type Accent = "brand" | "warn" | "muted" | "default";

const ACCENT: Record<Accent, string> = {
  brand: "var(--md-sys-color-primary)",
  warn: "var(--md-sys-color-tertiary)",
  muted: "var(--md-sys-color-on-surface-variant)",
  default: "var(--md-sys-color-on-surface)",
};

export function DossierStat({
  title,
  value,
  prefix,
  accent = "default",
  href,
}: {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  accent?: Accent;
  href?: string;
}) {
  const body = (
    <Md3Card className="dossier-stat h-full">
      <p className="dossier-stat-title mb-1">{title}</p>
      <p
        className="flex items-baseline gap-2 text-[28px] font-normal leading-none tabular-nums"
        style={{ color: ACCENT[accent] }}
      >
        {prefix}
        {value}
      </p>
    </Md3Card>
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "dossier-stat-link block no-underline transition-colors",
          "hover:[&_.dossier-stat]:border-[var(--md-sys-color-primary)]",
        )}
      >
        {body}
      </a>
    );
  }

  return body;
}
