"use client";

import Link from "next/link";
import { Dropdown, Button } from "antd";
import type { MenuProps } from "antd";
import {
  FileTextOutlined,
  MailOutlined,
  TeamOutlined,
  MoreOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useJobs } from "@/components/jobs/job-store";
import { message } from "antd";

export function PipelineRowActions({
  n,
  company,
  role,
}: {
  n: string;
  company: string;
  role: string;
}) {
  const { jobs, startJob } = useJobs();

  const busy = jobs.some((j) => j.input === n && j.status === "running");

  const run = (kind: string, title: string) => {
    const id = startJob({ title, subtitle: role, kind, input: n, page: `/pipeline/${n}` });
    if (id) message.info(`Started ${title.toLowerCase()} — see Workers.`);
  };

  const items: MenuProps["items"] = [
    { key: "view", icon: <EyeOutlined />, label: <Link href={`/pipeline/${n}`}>Open report</Link> },
    { type: "divider" },
    { key: "pdf", icon: <FileTextOutlined />, label: "Generate CV PDF", onClick: () => run("pdf", `CV PDF · ${company}`) },
    { key: "cover", icon: <FileTextOutlined />, label: "Cover letter", onClick: () => run("cover", `Cover · ${company}`) },
    { key: "email", icon: <MailOutlined />, label: "Application email", onClick: () => run("email", `Email · ${company}`) },
    { key: "contacto", icon: <TeamOutlined />, label: "Find contacts", onClick: () => run("contacto", `Contacts · ${company}`) },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]} disabled={busy}>
      <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Row actions" />
    </Dropdown>
  );
}
