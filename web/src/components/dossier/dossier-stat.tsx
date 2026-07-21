"use client";

import type { ReactNode } from "react";
import { Card, Statistic } from "antd";

type Accent = "brand" | "warn" | "muted" | "default";

const ACCENT: Record<Accent, string | undefined> = {
  brand: "var(--ant-color-primary)",
  warn: "var(--ant-color-warning)",
  muted: "var(--ant-color-text-secondary)",
  default: undefined,
};

export function DossierStat({
  title,
  value,
  prefix,
  accent = "default",
  href,
}: {
  title: string;
  value: number;
  prefix?: ReactNode;
  accent?: Accent;
  href?: string;
}) {
  const color = ACCENT[accent];
  const body = (
    <Statistic
      title={title}
      value={value}
      prefix={prefix}
      styles={color ? { content: { color } } : undefined}
    />
  );

  if (href) {
    return (
      <a href={href} className="dossier-stat-link block no-underline">
        <Card size="small" className="dossier-stat h-full transition hover:border-[var(--ant-color-primary)]">
          {body}
        </Card>
      </a>
    );
  }

  return (
    <Card size="small" className="dossier-stat h-full">
      {body}
    </Card>
  );
}
