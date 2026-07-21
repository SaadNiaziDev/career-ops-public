"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Space, Tag, Typography } from "antd";
import { CheckOutlined, CloseOutlined, FileTextOutlined, LoadingOutlined } from "@ant-design/icons";
import { CompanyLogo } from "@/components/company-logo";
import { scoreNum, scoreTone } from "@/lib/format";
import type { Application } from "@/lib/career-ops";

const SCORE_COLOR = { good: "success", warn: "warning", bad: "error", muted: "default" } as const;

export function DecisionCard({ app }: { app: Application }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "Applied" | "Discarded">("");
  const [done, setDone] = useState<string | null>(null);
  const score = scoreNum(app.score);
  const tone = scoreTone(app.score);

  const setStatus = async (status: "Applied" | "Discarded") => {
    setBusy(status);
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: app.n, status }),
      });
      setDone(status);
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy("");
    }
  };

  if (done) return null;

  return (
    <Card size="small" className="dossier-decision-card h-full">
      <div className="mb-3 flex items-start gap-2.5">
        <CompanyLogo name={app.company} size={24} />
        <div className="min-w-0 flex-1">
          <Typography.Text strong className="block truncate">
            {app.company}
          </Typography.Text>
          <Typography.Text type="secondary" className="block truncate text-sm">
            {app.role}
          </Typography.Text>
        </div>
        {Number.isFinite(score) && score > 0 && (
          <Tag color={SCORE_COLOR[tone]}>{app.score}</Tag>
        )}
      </div>
      <Space wrap className="w-full">
        <Button
          type="primary"
          size="small"
          disabled={!!busy}
          icon={busy === "Applied" ? <LoadingOutlined /> : <CheckOutlined />}
          onClick={() => setStatus("Applied")}
        >
          Mark applied
        </Button>
        <Button
          size="small"
          disabled={!!busy}
          icon={busy === "Discarded" ? <LoadingOutlined /> : <CloseOutlined />}
          onClick={() => setStatus("Discarded")}
        >
          Skip
        </Button>
        <Button
          type="text"
          size="small"
          href={`/pipeline/${app.n}`}
          icon={<FileTextOutlined />}
          aria-label="Open report"
        />
      </Space>
    </Card>
  );
}
