"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Drawer, Space, Tag, Typography, message } from "antd";
import {
  FileTextOutlined,
  MailOutlined,
  TeamOutlined,
  LoadingOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useJobs } from "@/components/jobs/job-store";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { ApplyButton } from "@/components/apply-button";
import { CostBadge } from "@/components/cost/cost-badge";
import type { DraftKind } from "@/lib/contacts";

type DraftState = { kind: DraftKind; content: string } | null;

const KIND_LABEL: Record<DraftKind, string> = {
  cover: "Cover letter",
  email: "Application email",
  contacto: "Contacts & outreach",
};

export function PipelineActions({
  n,
  company,
  role,
  url,
  pdfReady,
}: {
  n: string;
  company: string;
  role?: string;
  url?: string;
  pdfReady: boolean;
}) {
  const { jobs, startJob } = useJobs();
  const [draft, setDraft] = useState<DraftState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [available, setAvailable] = useState<DraftKind[]>([]);

  const loadDrafts = useCallback(() => {
    fetch(`/api/drafts?n=${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((d) => {
        const rawKinds = (Array.isArray(d.drafts) ? d.drafts : []) as { kind?: string }[];
        const kinds = rawKinds
          .map((x) => x.kind)
          .filter((k: string | undefined): k is DraftKind => k === "cover" || k === "email" || k === "contacto");
        setAvailable([...new Set<DraftKind>(kinds)]);
      })
      .catch(() => {});
  }, [n]);

  useEffect(() => {
    loadDrafts();
    const onDone = () => loadDrafts();
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [loadDrafts]);

  const runningKind = useMemo(() => {
    const active = jobs.find((j) => j.input === n && j.status === "running" && ["cover", "email", "contacto"].includes(j.kind ?? ""));
    return active?.kind as DraftKind | undefined;
  }, [jobs, n]);

  const run = (kind: DraftKind, title: string) => {
    const id = startJob({
      title,
      subtitle: role ?? company,
      kind,
      input: n,
      page: `/pipeline/${n}`,
    });
    if (id) message.info(`Started ${KIND_LABEL[kind].toLowerCase()} worker — check Workers for progress.`);
  };

  const openDraft = async (kind: DraftKind) => {
    const res = await fetch(`/api/drafts?n=${encodeURIComponent(n)}&kind=${kind}`);
    if (!res.ok) {
      message.warning("Draft not ready yet — run the worker first.");
      return;
    }
    const data = await res.json();
    setDraft({ kind, content: data.content ?? "" });
    setDrawerOpen(true);
  };

  const actionBtn = (kind: DraftKind, icon: ReactNode, label: string) => {
    const has = available.includes(kind);
    const running = runningKind === kind;
    return (
      <Button
        key={kind}
        icon={running ? <LoadingOutlined /> : icon}
        loading={running}
        onClick={() => (has ? openDraft(kind) : run(kind, label))}
        onContextMenu={(e) => {
          e.preventDefault();
          run(kind, label);
        }}
      >
        {has ? `View ${KIND_LABEL[kind].toLowerCase()}` : label}
      </Button>
    );
  };

  return (
    <>
      <Space wrap size="small" className="pipeline-actions">
        <GeneratePdfButton n={n} company={company} pdfReady={pdfReady} />
        {actionBtn("cover", <FileTextOutlined />, `Cover · ${company}`)}
        {actionBtn("email", <MailOutlined />, `Email · ${company}`)}
        {actionBtn("contacto", <TeamOutlined />, `Find contacts · ${company}`)}
        <ApplyButton n={n} url={url?.startsWith("http") ? url : undefined} company={company} pdfReady={pdfReady} />
        {available.length > 0 && (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDraft(available[0])}>
            Open latest draft
          </Button>
        )}
        <CostBadge kind="spend" size="xs" />
      </Space>

      <Drawer
        title={draft ? KIND_LABEL[draft.kind] : "Draft"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={560}
        rootClassName="lenis-drawer-root"
        extra={
          draft && (
            <Button
              size="small"
              onClick={() => {
                void navigator.clipboard.writeText(draft.content);
                message.success("Copied to clipboard");
              }}
            >
              Copy
            </Button>
          )
        }
      >
        {draft && (
          <>
            <Tag color="orange">Draft only — review before sending</Tag>
            <Typography.Paragraph type="secondary" className="!mt-3 !mb-4 text-xs">
              Right-click any action button to regenerate. Contacts also appear on the Outreach page.
            </Typography.Paragraph>
            <article data-lenis-prevent className="report-prose max-h-[70vh] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content}</ReactMarkdown>
            </article>
          </>
        )}
      </Drawer>
    </>
  );
}
