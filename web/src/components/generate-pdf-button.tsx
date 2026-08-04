"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  FilePdfOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Space } from "antd";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

export function GeneratePdfButton({
  n,
  company,
  pdfReady,
  rail = false,
}: {
  n: string;
  company: string;
  pdfReady: boolean;
  rail?: boolean;
}) {
  const { jobs, startJob } = useJobs();
  const job = useMemo(
    () => jobs.filter((j) => j.kind === "pdf" && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, n],
  );
  const generate = () =>
    startJob({
      title: `CV PDF · ${company}`,
      subtitle: "tailored for this role",
      kind: "pdf",
      input: n,
      page: `/pipeline/${n}`,
    });

  if (job?.status === "running") {
    return (
      <Link href={`/jobs/${job.id}`}>
        <Button block={rail} icon={<LoadingOutlined spin />}>
          Generating CV…
        </Button>
      </Link>
    );
  }

  const ready = pdfReady || job?.status === "done";
  if (ready) {
    if (rail) {
      return (
        <Space.Compact block className="w-full">
          <Button
            type="primary"
            block
            icon={<FileTextOutlined />}
            href={`/api/cv-pdf?company=${encodeURIComponent(company)}`}
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600! hover:bg-emerald-500! border-emerald-600!"
          >
            View tailored CV
          </Button>
          <Button icon={<ReloadOutlined />} onClick={generate} title="Regenerate CV" />
        </Space.Compact>
      );
    }
    return (
      <Space size={4}>
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          href={`/api/cv-pdf?company=${encodeURIComponent(company)}`}
          target="_blank"
          rel="noreferrer"
          className="bg-emerald-600! hover:bg-emerald-500! border-emerald-600!"
        >
          View tailored CV
        </Button>
        <Button icon={<ReloadOutlined />} onClick={generate} title="Regenerate the tailored CV" />
      </Space>
    );
  }

  if (rail) {
    return (
      <Button block icon={<FilePdfOutlined />} onClick={generate}>
        Generate tailored CV
      </Button>
    );
  }

  return (
    <Space size={8}>
      <Button icon={<FilePdfOutlined />} onClick={generate} title="Generate an ATS-optimized CV tailored to this role">
        Generate tailored CV (PDF)
      </Button>
      <CostBadge kind="spend" size="xs" />
    </Space>
  );
}
