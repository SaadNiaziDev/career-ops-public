"use client";

import { useState } from "react";
import { Button, Space, Typography } from "antd";
import { CheckOutlined, ClockCircleOutlined, FileTextOutlined, LoadingOutlined } from "@ant-design/icons";
import { CompanyLogo } from "@/components/company-logo";

export type FollowUp = {
  num?: number;
  company: string;
  role?: string;
  status?: string;
  appliedDate?: string;
  notes?: string;
};

export function FollowUpCard({
  followup,
  onLogged,
}: {
  followup: FollowUp;
  onLogged?: () => void;
}) {
  const [state, setState] = useState<"idle" | "logging" | "done" | "snoozed">("idle");
  if (state === "snoozed" || state === "done") return null;

  const log = async () => {
    setState("logging");
    try {
      await fetch("/api/followups/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: followup.num, company: followup.company, note: "Followed up" }),
      });
    } catch {
      /* best-effort */
    }
    onLogged?.();
    setState("done");
  };

  return (
    <div className="dossier-followup flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface/40 px-3.5 py-3">
      <div className="flex min-w-0 flex-[1_1_55%] items-center gap-3">
        <CompanyLogo name={followup.company} size={22} />
        <div className="min-w-0 flex-1">
          <Typography.Text className="block truncate text-sm">
            <span className="font-medium">{followup.company}</span>
            {followup.role && (
              <Typography.Text type="secondary"> · {followup.role}</Typography.Text>
            )}
          </Typography.Text>
          <Typography.Text type="secondary" className="flex items-center gap-1 text-xs">
            <ClockCircleOutlined />
            {followup.appliedDate ? `Applied ${followup.appliedDate}` : "Follow-up due"}
          </Typography.Text>
        </div>
      </div>
      <Space wrap className="ml-auto">
        <Button
          size="small"
          loading={state === "logging"}
          icon={state !== "logging" ? <CheckOutlined /> : undefined}
          onClick={log}
        >
          Mark followed up
        </Button>
        {followup.num != null && (
          <Button type="text" size="small" href={`/pipeline/${followup.num}`} icon={<FileTextOutlined />} />
        )}
        <Button type="link" size="small" onClick={() => setState("snoozed")}>
          Snooze
        </Button>
      </Space>
    </div>
  );
}
