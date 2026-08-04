"use client";

import type { ReactNode } from "react";
import { Typography } from "antd";
import { cn } from "@/lib/cn";

const { Title, Paragraph } = Typography;

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
        <Title level={2} className="mb-1! font-display!">
          {title}
        </Title>
        {description != null && (
          <Paragraph type="secondary" className="mb-0! max-w-2xl">
            {description}
          </Paragraph>
        )}
      </div>
      {extra != null && <div className="shrink-0">{extra}</div>}
    </div>
  );
}
