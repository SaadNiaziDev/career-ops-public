"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  LoadingOutlined,
  RedoOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Card, Collapse, Empty, Space, Tag, Timeline, Typography } from "antd";
import { useJobs } from "@/components/jobs/job-store";
import { HeroGlow } from "@/components/hero-glow";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack, DossierInsetStack } from "@/components/dossier/dossier-stack";
import {
  collapseSteps,
  fmtElapsed,
  fmtTokens,
  formatCollapsedStep,
  isAuthError,
  jobBackHref,
  jobDuration,
  resolveArtifact,
  SCORE_TAG_COLOR,
  useElapsed,
} from "@/components/jobs/job-utils";

const { Title, Text, Paragraph } = Typography;

function StatusTag({ status }: { status: "running" | "done" | "error" }) {
  if (status === "running") {
    return (
      <Tag icon={<LoadingOutlined spin />} color="processing">
        Working
      </Tag>
    );
  }
  if (status === "done") {
    return (
      <Tag icon={<CheckCircleOutlined />} color="success">
        Done
      </Tag>
    );
  }
  return (
    <Tag icon={<CloseCircleOutlined />} color="error">
      Error
    </Tag>
  );
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { jobs, startJob } = useJobs();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const job = jobs.find((j) => j.id === id);
  const running = job?.status === "running";
  const elapsed = useElapsed(running ?? false, job?.startedAt ?? Date.now());
  const artifact = job ? resolveArtifact(job) : null;
  const steps = useMemo(() => (job ? collapseSteps(job.steps) : []), [job]);
  const [outputOpen, setOutputOpen] = useState<boolean | undefined>(undefined);
  const outputExpanded = outputOpen ?? running;

  if (!job) {
    return (
      <PageShell width="narrow">
        <DossierStack>
          <Link href="/pipeline">
            <Button type="text" icon={<ArrowLeftOutlined />} className="px-0">
              Pipeline
            </Button>
          </Link>
          <Empty
            description="This worker is no longer in memory — it finished earlier or the page was reloaded."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Space size="middle">
              <Link href="/jobs">
                <Button>Worker history</Button>
              </Link>
              <Link href="/pipeline">
                <Button type="primary">Pipeline</Button>
              </Link>
            </Space>
          </Empty>
        </DossierStack>
      </PageShell>
    );
  }

  const backHref = jobBackHref(job);
  const backLabel = backHref === "/pipeline" ? "Pipeline" : backHref === "/jobs" ? "Workers" : "Back";
  const duration = running ? elapsed : jobDuration(job);
  const authError = isAuthError(job);
  const tokens = job.status === "done" ? job.cost?.tokens ?? 0 : 0;
  const canRetry = job.status === "error" && !!job.kind && !!job.input;

  const retry = () => {
    if (!canRetry || retrying) return;
    setRetrying(true); // optimistic: flip immediately, the new job also appears "running" the instant startJob returns
    const newId = startJob({
      title: job.title,
      subtitle: job.subtitle,
      kind: job.kind!,
      input: job.input!,
      page: job.page,
      batchId: job.batchId,
    });
    if (newId) router.push(`/jobs/${newId}`);
    else setRetrying(false);
  };

  const timelineItems = [
    ...steps.map((step, i) => ({
      key: `${step.label}-${i}`,
      color: step.kind === "tool" ? ("blue" as const) : ("gray" as const),
      children: (
        <Text type={step.kind === "tool" ? undefined : "secondary"}>{formatCollapsedStep(step)}</Text>
      ),
    })),
    ...(running
      ? [
          {
            key: "thinking",
            color: "blue" as const,
            dot: <LoadingOutlined spin />,
            children: <Text type="secondary">Thinking…</Text>,
          },
        ]
      : []),
  ];

  return (
    <PageShell width="narrow">
      <DossierStack>
        <Link href={backHref}>
          <Button type="text" icon={<ArrowLeftOutlined />} className="px-0">
            {backLabel}
          </Button>
        </Link>

        <Card className="relative overflow-hidden">
          {running && <HeroGlow />}
          <DossierInsetStack className="relative z-10">
            <Space wrap size={[10, 10]} className="w-full items-center justify-between">
              <Space wrap size={[10, 10]}>
                <StatusTag status={job.status} />
                {job.result?.score != null && (
                  <Tag color={SCORE_TAG_COLOR[job.result.tone]}>{job.result.score}/5</Tag>
                )}
                <Text type="secondary" className="text-xs tabular-nums">
                  {fmtElapsed(duration)}
                  {tokens > 0 && ` · ${fmtTokens(tokens)} tokens`}
                  {job.cost?.usd != null && ` · $${job.cost.usd.toFixed(2)}`}
                </Text>
              </Space>
              {canRetry && (
                <Button size="small" icon={<RedoOutlined />} loading={retrying} onClick={retry}>
                  Retry
                </Button>
              )}
            </Space>

            <div>
              <Title level={2} className="mb-1! font-display!">
                {job.title}
              </Title>
              {job.subtitle && (
                <Paragraph type="secondary" className="mb-0!">
                  {job.subtitle}
                </Paragraph>
              )}
            </div>

            {job.status === "done" && job.result?.summary && !artifact && (
              <Paragraph type="secondary" className="mb-0!">
                {job.result.summary}
              </Paragraph>
            )}

            {artifact && (
              <Space wrap size="middle">
                <Button
                  type="primary"
                  size="large"
                  icon={<FileTextOutlined />}
                  href={artifact.href}
                  target={artifact.href.startsWith("/api/") ? "_blank" : undefined}
                  rel={artifact.href.startsWith("/api/") ? "noreferrer" : undefined}
                >
                  {artifact.label}
                </Button>
                {artifact.path && (
                  <Text type="secondary" className="text-xs font-mono">
                    {artifact.path}
                  </Text>
                )}
              </Space>
            )}

            {authError && (
              <Space wrap size="middle">
                <Text type="warning">Sign your CLI in from Config, then re-run.</Text>
                <Link href="/config">
                  <Button icon={<SettingOutlined />}>Open Config</Button>
                </Link>
                {canRetry && (
                  <Button icon={<RedoOutlined />} loading={retrying} onClick={retry}>
                    Retry
                  </Button>
                )}
              </Space>
            )}

            {canRetry && !authError && (
              <Space wrap size="middle">
                <Button type="primary" icon={<RedoOutlined />} loading={retrying} onClick={retry}>
                  Retry
                </Button>
              </Space>
            )}
          </DossierInsetStack>
        </Card>

        {steps.length > 0 && (
          <Card title="Activity" size="small">
            <Timeline items={timelineItems} />
          </Card>
        )}

        {job.text && (
          <Collapse
            activeKey={outputExpanded ? ["output"] : []}
            onChange={(keys) => setOutputOpen(keys.includes("output"))}
            items={[
              {
                key: "output",
                label: running ? "Output (live)" : "Output",
                children: (
                  <div className="report-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.text}</ReactMarkdown>
                  </div>
                ),
              },
            ]}
          />
        )}
      </DossierStack>
    </PageShell>
  );
}
