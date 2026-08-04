"use client";

import Link from "next/link";
import { Card, Col, Progress, Row, Statistic, Typography } from "antd";
import type { Application } from "@/lib/career-ops";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierSection } from "@/components/dossier/dossier-section";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { canonStatus, scoreNum } from "@/lib/format";

const { Text } = Typography;

const STAGES: { key: string; label: string }[] = [
  { key: "EVALUATED", label: "Evaluated" },
  { key: "APPLIED", label: "Applied" },
  { key: "RESPONDED", label: "Responded" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "OFFER", label: "Offer" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DISCARDED", label: "Discarded" },
];

function BarRow({
  label,
  value,
  pct,
  total,
  strokeColor,
}: {
  label: string;
  value: number;
  pct: number;
  total?: number;
  strokeColor?: string;
}) {
  const share = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div className="flex items-center gap-4 py-0.5">
      <Text type="secondary" className="w-32 shrink-0 truncate text-sm">
        {label}
      </Text>
      <Progress
        percent={Math.max(pct, value > 0 ? 4 : 0)}
        showInfo={false}
        strokeColor={strokeColor}
        className="flex-1"
      />
      <Text className="w-20 shrink-0 text-right tabular-nums">
        {value}
        {share !== null && (
          <Text type="secondary" className="ml-1 text-xs">
            {share}%
          </Text>
        )}
      </Text>
    </div>
  );
}

export function AnalyticsView({ applications }: { applications: Application[] }) {
  const total = applications.length;

  const stageCounts = STAGES.map((s) => ({
    ...s,
    n: applications.filter((a) => canonStatus(a.status).includes(s.key)).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  const scores = applications.map((a) => scoreNum(a.score)).filter((n) => !Number.isNaN(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buckets = [
    { label: "4.5 – 5.0", test: (n: number) => n >= 4.5 },
    { label: "4.0 – 4.4", test: (n: number) => n >= 4 && n < 4.5 },
    { label: "3.0 – 3.9", test: (n: number) => n >= 3 && n < 4 },
    { label: "< 3.0", test: (n: number) => n < 3 },
  ].map((b) => ({ label: b.label, n: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const companyCounts = new Map<string, number>();
  for (const a of applications) if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCompany = Math.max(1, ...topCompanies.map((c) => c[1]));

  const offers = stageCounts.find((s) => s.key === "OFFER")?.n ?? 0;
  const interviews = stageCounts.find((s) => s.key === "INTERVIEW")?.n ?? 0;

  return (
    <PageShell width="default">
      <DossierStack>
        <DossierPageHeader title="Analytics" description={`Across ${total} tracked evaluations.`} />

        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <DossierStat title="evaluated" value={total} />
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" className="dossier-stat h-full">
              <Statistic title="avg score" value={avg ? avg.toFixed(2) : "—"} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <DossierStat
              title="interviews"
              value={interviews}
              href={interviews === 0 ? "/" : undefined}
              accent={interviews === 0 ? "muted" : "default"}
            />
            {interviews === 0 && (
              <Link href="/">
                <Text type="secondary" className="mt-2 block text-xs">
                  Interviews follow replies — keep follow-ups warm
                </Text>
              </Link>
            )}
          </Col>
          <Col xs={12} sm={6}>
            <DossierStat title="offers" value={offers} accent={offers > 0 ? "brand" : "muted"} />
          </Col>
        </Row>

        <DossierSection title="Pipeline by stage">
          {stageCounts.map((s) => (
            <BarRow
              key={s.key}
              label={s.label}
              value={s.n}
              pct={(s.n / maxStage) * 100}
              total={total}
              strokeColor={s.key === "OFFER" ? "var(--ant-color-success)" : undefined}
            />
          ))}
        </DossierSection>

        <DossierSection title="Score distribution">
          {buckets.map((b) => (
            <BarRow key={b.label} label={b.label} value={b.n} pct={(b.n / maxBucket) * 100} total={scores.length} />
          ))}
        </DossierSection>

        <DossierSection title="Top companies">
          {topCompanies.map(([name, n]) => (
            <BarRow key={name} label={name} value={n} pct={(n / maxCompany) * 100} />
          ))}
        </DossierSection>
      </DossierStack>
    </PageShell>
  );
}
