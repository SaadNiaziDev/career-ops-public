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
  contacto: "Outreach contacts",
};

const RUN_LABEL: Record<DraftKind, string> = {
  cover: "Write cover letter",
  email: "Draft application email",
  contacto: "Find people to reach out to",
};

export function PipelineActions({
  n,
  company,
  role,
  url,
  pdfReady,
  variant = "inline",
}: {
  n: string;
  company: string;
  role?: string;
  url?: string;
  pdfReady: boolean;
  variant?: "inline" | "rail";
}) {
  const { jobs, startJob } = useJobs();
  const [draft, setDraft] = useState<DraftState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [available, setAvailable] = useState<DraftKind[]>([]);
  const rail = variant === "rail";

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

  const run = (kind: DraftKind) => {
    const id = startJob({
      title: `${KIND_LABEL[kind]} · ${company}`,
      subtitle: role ?? company,
      kind,
      input: n,
      page: `/pipeline/${n}`,
    });
    if (id) message.info(`Started ${KIND_LABEL[kind].toLowerCase()} — check Workers for progress.`);
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

  const actionBtn = (kind: DraftKind, icon: ReactNode) => {
    const has = available.includes(kind);
    const running = runningKind === kind;
    const label = has ? `View ${KIND_LABEL[kind].toLowerCase()}` : RUN_LABEL[kind];
    return (
      <Button
        key={kind}
        block={rail}
        type={rail && kind === "cover" && !has ? "default" : undefined}
        icon={running ? <LoadingOutlined /> : icon}
        loading={running}
        onClick={() => (has ? openDraft(kind) : run(kind))}
        onContextMenu={(e) => {
          e.preventDefault();
          run(kind);
        }}
      >
        {label}
      </Button>
    );
  };

  const actions = (
    <>
      <GeneratePdfButton n={n} company={company} pdfReady={pdfReady} rail={rail} />
      {actionBtn("cover", <FileTextOutlined />)}
      {actionBtn("email", <MailOutlined />)}
      {actionBtn("contacto", <TeamOutlined />)}
      <ApplyButton n={n} url={url?.startsWith("http") ? url : undefined} company={company} pdfReady={pdfReady} rail={rail} />
      {available.length > 0 && (
        <Button type="link" size="small" block={rail} icon={<EyeOutlined />} onClick={() => openDraft(available[0])}>
          Open latest draft
        </Button>
      )}
      {!rail && <CostBadge kind="spend" size="xs" />}
    </>
  );

  return (
    <>
      {rail ? (
        <Space direction="vertical" size={6} className="report-rail-actions w-full">
          {actions}
          <CostBadge kind="spend" size="xs" className="mt-0.5" />
        </Space>
      ) : (
        <Space wrap size="middle" className="pipeline-actions w-full">
          {actions}
        </Space>
      )}

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
            <Typography.Paragraph type="secondary" className="mt-3! mb-4! text-xs">
              Right-click any action to regenerate. Contacts also appear on Outreach.
            </Typography.Paragraph>
            <article data-lenis-prevent className="report-prose-compact max-h-[70vh] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content}</ReactMarkdown>
            </article>
          </>
        )}
      </Drawer>
    </>
  );
}
