"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Col, Row, Typography, Button, List, Empty, Badge, Flex } from "antd";
import {
  BellOutlined,
  CompassOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  FundOutlined,
} from "@ant-design/icons";
import type { Application, InboxJob } from "@/lib/career-ops";
import type { DiscoveredOffer } from "@/lib/explore";
import { DiscoveryCard } from "@/components/explore/discovery-card";
import { FollowUpCard, type FollowUp } from "@/components/home/follow-up-card";
import { DecisionCard } from "@/components/home/decision-card";
import { QuickEvaluate } from "@/components/quick-evaluate";
import { TitlesBroadening } from "@/components/portals/titles-broadening";
import { DossierHero } from "@/components/dossier/dossier-hero";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { DossierSection } from "@/components/dossier/dossier-section";
import { PageShell } from "@/components/dossier/page-shell";

export function TodayDashboard({
  applications,
  inbox,
  inBetween,
}: {
  applications: Application[];
  inbox: InboxJob[];
  inBetween: boolean;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const router = useRouter();
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    [],
  );

  const refetch = useCallback(() => {
    fetch("/api/followups")
      .then((r) => r.json())
      .then((d) => {
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setOverdue(d.metadata?.overdue ?? d.entries?.length ?? 0);
      })
      .catch(() => {});
    fetch("/api/whats-new")
      .then((r) => r.json())
      .then((d) => setFresh(Array.isArray(d.offers) ? d.offers : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
    const onDone = () => {
      router.refresh();
      refetch();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [refetch, router]);

  const awaiting = useMemo(
    () => applications.filter((a) => /^evaluat/i.test(a.status)).slice(0, 6),
    [applications],
  );

  const newThisWeek = fresh.length;
  const allClear = newThisWeek === 0 && overdue === 0 && awaiting.length === 0;
  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const actionCount = overdue + awaiting.length + Math.min(newThisWeek, 6);

  return (
    <PageShell width="6xl">
      <DossierHero
        eyebrow={`Job search dossier · ${dateLabel}`}
        title={
          allClear ? (
            "You're all caught up"
          ) : (
            <span className="inline-flex items-center gap-3">
              Today&apos;s action queue
              {actionCount > 0 && <Badge count={actionCount} color="var(--ant-color-primary)" />}
            </span>
          )
        }
        description={
          allClear
            ? "Scanning continues in the background — new matches appear here when they fit your profile."
            : "Discovery, follow-ups, and scored roles in one place. Work top to bottom."
        }
        actions={
          <>
            <Link href="/explore">
              <Button type="primary" size="large" icon={<CompassOutlined />}>
                Find new roles
              </Button>
            </Link>
            <Link href="/pipeline">
              <Button size="large" icon={<ArrowRightOutlined />}>
                Open pipeline
              </Button>
            </Link>
          </>
        }
        footer={inBetween ? <QuickEvaluate /> : undefined}
      />

      <Row gutter={[12, 12]} className="mb-5 sm:mb-6">
        <Col xs={12} md={6}>
          <DossierStat
            title="New this week"
            value={newThisWeek}
            prefix={<RocketOutlined />}
            accent={newThisWeek > 0 ? "brand" : "muted"}
            href="/explore"
          />
        </Col>
        <Col xs={12} md={6}>
          <DossierStat
            title="Follow-ups due"
            value={overdue}
            prefix={<BellOutlined />}
            accent={overdue > 0 ? "warn" : "muted"}
          />
        </Col>
        <Col xs={12} md={6}>
          <DossierStat
            title="Awaiting decision"
            value={awaiting.length}
            prefix={<QuestionCircleOutlined />}
            accent={awaiting.length > 0 ? "brand" : "muted"}
            href={awaiting.length > 0 ? "/pipeline?tab=EVALUATED" : undefined}
          />
        </Col>
        <Col xs={12} md={6}>
          <DossierStat
            title="Tracked roles"
            value={applications.length}
            prefix={<FundOutlined />}
            href="/pipeline"
          />
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Flex vertical gap={16}>
            {followups.length > 0 && (
              <DossierSection
                icon={<BellOutlined className="text-[var(--ant-color-warning)]" />}
                title="Follow-ups due"
                hint="Keep applications alive"
              >
                <List
                  split={false}
                  dataSource={followups}
                  renderItem={(f) => (
                    <List.Item key={`${f.num}-${f.company}`} className="px-0! pb-2! pt-0!">
                      <FollowUpCard followup={f} onLogged={() => setOverdue((n) => Math.max(0, n - 1))} />
                    </List.Item>
                  )}
                />
              </DossierSection>
            )}

            {awaiting.length > 0 && (
              <DossierSection
                icon={<QuestionCircleOutlined className="text-[var(--ant-color-primary)]" />}
                title="Awaiting your decision"
                hint="Scored — apply or skip"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {awaiting.map((a) => (
                    <DecisionCard key={a.n} app={a} />
                  ))}
                </div>
              </DossierSection>
            )}

            {fresh.length > 0 && (
              <DossierSection
                icon={<RocketOutlined className="text-[var(--ant-color-primary)]" />}
                title="Fresh matches this week"
                extra={
                  fresh.length > 6 ? (
                    <Link href="/explore">
                      <Typography.Link>See all {fresh.length}</Typography.Link>
                    </Link>
                  ) : (
                    <Typography.Text type="secondary" className="text-xs">
                      Free scans · 0 tokens
                    </Typography.Text>
                  )
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {fresh.slice(0, 6).map((o) => (
                    <DiscoveryCard key={o.url} offer={o} inPipeline={inboxUrls.has(o.url)} />
                  ))}
                </div>
              </DossierSection>
            )}

            {allClear && (
              <DossierSection title="All clear" hint="Nothing urgent">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <>
                      Run a <Link href="/explore">free scan</Link> or review your{" "}
                      <Link href="/pipeline">pipeline</Link>.
                    </>
                  }
                />
              </DossierSection>
            )}
          </Flex>
        </Col>

        <Col xs={24} lg={8}>
          <TitlesBroadening compact />
        </Col>
      </Row>
    </PageShell>
  );
}
