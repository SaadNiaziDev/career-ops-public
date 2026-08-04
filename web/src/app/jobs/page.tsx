"use client";

import Link from "next/link";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Button, Empty, List, Tag, Typography } from "antd";
import { useJobs } from "@/components/jobs/job-store";
import { pillTone } from "@/components/jobs/worker-pills";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { SCORE_TAG_COLOR } from "@/components/jobs/job-utils";

const { Text } = Typography;

function StatusIcon({ status }: { status: "running" | "done" | "error" }) {
  if (status === "running") return <LoadingOutlined spin className="text-[var(--ant-color-primary)]" />;
  if (status === "error") return <CloseCircleOutlined className="text-red-400" />;
  return <CheckCircleOutlined className="text-emerald-500" />;
}

export default function JobsHistory() {
  const { jobs, clearFinished } = useJobs();

  return (
    <PageShell width="default">
      <DossierStack>
        <DossierPageHeader
          title="Workers"
          description={
            <>
              Every evaluation you ran — a persistent log. <span className="tabular-nums">{jobs.length}</span> total.
            </>
          }
          extra={
            jobs.some((j) => j.status !== "running") ? (
              <Button icon={<DeleteOutlined />} onClick={clearFinished}>
                Clear finished
              </Button>
            ) : undefined
          }
        />

        {jobs.length === 0 ? (
          <Empty
            description={
              <>
                No workers yet. Hit <Text strong>Evaluate</Text> on an inbox posting to spin one up.
              </>
            }
          />
        ) : (
          <List
            bordered
            dataSource={jobs}
            renderItem={(j) => {
              const tone = pillTone(j);
              return (
                <List.Item
                  actions={[
                    j.result?.score != null ? (
                      <Tag key="score" color={SCORE_TAG_COLOR[tone]}>
                        {j.result.score}/5
                      </Tag>
                    ) : null,
                    <Text key="status" type="secondary" className="hidden capitalize sm:inline">
                      {j.status}
                    </Text>,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<StatusIcon status={j.status} />}
                    title={
                      <Link href={`/jobs/${j.id}`} className="hover:text-[var(--ant-color-primary)]">
                        {j.title}
                      </Link>
                    }
                    description={j.result?.summary || j.subtitle}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </DossierStack>
    </PageShell>
  );
}
