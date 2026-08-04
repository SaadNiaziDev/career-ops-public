"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircleOutlined,
  LoadingOutlined,
  RadarChartOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Alert, Button, List, Space, Tag, Typography } from "antd";
import { CompanyLogo } from "@/components/company-logo";
import { useJobs, type Job } from "@/components/jobs/job-store";

const { Text } = Typography;

type Company = { name: string; status: string; detail: string };
type Result = { available: boolean; configured: boolean; companies: Company[] };

const TONE: Record<string, { color: string; label: string }> = {
  live: { color: "success", label: "live" },
  empty: { color: "warning", label: "live · empty" },
  broken: { color: "error", label: "broken" },
  skipped: { color: "default", label: "no ATS" },
};
const ORDER: Record<string, number> = { broken: 0, empty: 1, live: 2, skipped: 3 };

export function PortalsView() {
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const { jobs, startJob } = useJobs();

  const fixByCompany = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) {
      if (j.kind !== "fix-portal" || !j.input) continue;
      const ex = m.get(j.input);
      if (!ex || j.startedAt > ex.startedAt) m.set(j.input, j);
    }
    return m;
  }, [jobs]);

  function check() {
    setLoading(true);
    fetch("/api/portals/verify")
      .then((r) => r.json())
      .then(setRes)
      .catch(() => setRes({ available: false, configured: false, companies: [] }))
      .finally(() => setLoading(false));
  }

  const companies = res?.companies ?? [];
  const broken = companies.filter((c) => c.status === "broken");
  const liveN = companies.filter((c) => c.status === "live" || c.status === "empty").length;
  const sorted = [...companies].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div>
      <Space wrap>
        <Button type="primary" icon={loading ? <LoadingOutlined spin /> : <RadarChartOutlined />} onClick={check} loading={loading}>
          Check portal health
        </Button>
        {loading && <Text type="secondary" className="text-xs">Probing each company&apos;s ATS… (~30–60s)</Text>}
      </Space>

      {res && !res.available && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message={
            <>
              <Text code>verify-portals.mjs</Text> not found — this needs a complete career-ops checkout.
            </>
          }
        />
      )}
      {res && res.available && !res.configured && (
        <Alert
          className="mt-4"
          type="info"
          showIcon
          message={
            <>
              No <Text code>portals.yml</Text> yet — set up scan keywords on the Portals page.
            </>
          }
        />
      )}

      {res && res.configured && (
        <div className="mt-5">
          <Text type="secondary">
            <Text type="success">{liveN}</Text> live · <Text type="danger">{broken.length}</Text> broken ·{" "}
            {companies.length} tracked
          </Text>
          {broken.length > 0 && (
            <Alert
              className="mt-3"
              type="error"
              showIcon
              message={
                <>
                  {broken.length} {broken.length === 1 ? "company silently drops" : "companies silently drop"} from every
                  scan — their careers link is broken. Fix the <Text code>careers_url</Text> in <Text code>portals.yml</Text> or
                  use Fix below.
                </>
              }
            />
          )}
          <List
            className="mt-4"
            bordered
            dataSource={sorted}
            renderItem={(c) => {
              const t = TONE[c.status] ?? TONE.skipped;
              return (
                <List.Item
                  actions={[
                    c.status === "broken" ? (
                      <FixAffordance
                        key="fix"
                        job={fixByCompany.get(c.name)}
                        onFix={() =>
                          startJob({
                            title: `Fix · ${c.name}`,
                            subtitle: "repair portal slug",
                            kind: "fix-portal",
                            input: c.name,
                            page: "/portals",
                          })
                        }
                      />
                    ) : null,
                    <Tag key="status" color={t.color}>
                      {t.label}
                    </Tag>,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<CompanyLogo name={c.name} size={24} />}
                    title={c.name}
                    description={<Text code className="text-xs">{c.detail}</Text>}
                  />
                </List.Item>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

function FixAffordance({ job, onFix }: { job?: Job; onFix: () => void }) {
  if (job?.status === "running") {
    return (
      <Link href={`/jobs/${job.id}`}>
        <Button type="link" size="small" icon={<LoadingOutlined spin />}>
          Fixing…
        </Button>
      </Link>
    );
  }
  if (job?.status === "done") {
    return (
      <Link href={`/jobs/${job.id}`}>
        <Button type="link" size="small" className="text-emerald-600">
          repaired · re-check
        </Button>
      </Link>
    );
  }
  return (
    <Button type="default" size="small" icon={<ToolOutlined />} onClick={onFix}>
      Fix
    </Button>
  );
}
