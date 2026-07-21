"use client";

import type { ReactNode } from "react";
import { Card, Space, Typography } from "antd";

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
    <Card
      className={className}
      title={
        <Space size={8}>
          {icon}
          <span>{title}</span>
        </Space>
      }
      extra={extra ?? (hint ? <Typography.Text type="secondary" className="text-xs">{hint}</Typography.Text> : undefined)}
    >
      {children}
    </Card>
  );
}
