"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Space, Typography, message, Card } from "antd";
import {
  LinkOutlined,
  ThunderboltOutlined,
  InboxOutlined,
  CompassOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";
import { aiToParams } from "@/lib/explore";
import { cn } from "@/lib/cn";

function guessFromUrl(url: string): { company: string; title: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const slug = u.pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ?? "";
    const title = slug && slug.length > 3 ? slug.slice(0, 80) : "Job posting";
    return { company: host, title };
  } catch {
    return { company: "", title: "Job posting" };
  }
}

function normalizeUrl(raw: string): string | null {
  const u = raw.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

type Props = {
  compact?: boolean;
  /** Where workers were launched from (for job store page field). */
  origin?: string;
  className?: string;
};

export function JobLinkHub({ compact = false, origin = "/add", className }: Props) {
  const router = useRouter();
  const { startJob } = useJobs();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<"" | "inbox">("");

  const url = normalizeUrl(raw);

  const evaluate = useCallback(() => {
    if (!url) {
      message.warning("Paste a full job URL (https://…).");
      return;
    }
    startJob({
      title: "Evaluate · pasted URL",
      subtitle: guessFromUrl(url).title,
      kind: "evaluate",
      input: url,
      page: origin,
    });
    message.info("Evaluation started — track progress in Workers.");
    setRaw("");
  }, [url, startJob, origin]);

  const addInbox = useCallback(async () => {
    if (!url) {
      message.warning("Paste a full job URL (https://…).");
      return;
    }
    setBusy("inbox");
    const { company, title } = guessFromUrl(url);
    try {
      const res = await fetch("/api/explore/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offers: [
            {
              url,
              company,
              title,
              location: "",
              postedAt: "",
              ats: "other",
              source: "manual",
            },
          ],
        }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (data.error || !data.added) {
        throw new Error(data.error || "Could not add to inbox");
      }
      message.success("Added to pipeline inbox");
      setRaw("");
      router.refresh();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusy("");
    }
  }, [url, router]);

  const aiSearchSimilar = useCallback(() => {
    if (!url) {
      message.warning("Paste a full job URL (https://…).");
      return;
    }
    const intent = `Find open job postings similar to this role (same seniority and stack where possible): ${url}`;
    router.push(`/explore?${aiToParams(intent)}`);
  }, [url, router]);

  const openExternal = useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  const body = (
    <>
      <Input
        size={compact ? "middle" : "large"}
        prefix={<LinkOutlined className="text-faint" />}
        placeholder="https://company.com/careers/…"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onPressEnter={evaluate}
        allowClear
      />
      <Space wrap className={cn("mt-4 gap-2!", compact && "mt-3")}>
        <Button type="primary" icon={<ThunderboltOutlined />} disabled={!url} onClick={evaluate}>
          Evaluate
        </Button>
        <CostBadge kind="spend" size="xs" />
        <Button icon={<InboxOutlined />} disabled={!url} loading={busy === "inbox"} onClick={() => void addInbox()}>
          Add to inbox
        </Button>
        <CostBadge kind="free-network" size="xs" />
        <Button icon={<CompassOutlined />} disabled={!url} onClick={aiSearchSimilar}>
          AI search similar
        </Button>
        <Button type="text" icon={<ExportOutlined />} disabled={!url} onClick={openExternal}>
          Open posting
        </Button>
      </Space>
      {!compact && (
        <Typography.Paragraph type="secondary" className="mb-0! mt-4 text-xs leading-relaxed">
          <strong>Evaluate</strong> runs the full A–F report and tracker row. <strong>Add to inbox</strong> queues the URL
          for triage without spending tokens. <strong>AI search similar</strong> opens Explore with a hunt for like roles.
        </Typography.Paragraph>
      )}
    </>
  );

  if (compact) {
    return (
      <div className={cn("rounded-2xl border border-border bg-surface/50 p-5 sm:p-6", className)}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Quick add</p>
        <p className="mt-1 text-sm font-medium text-foreground">Paste a job URL</p>
        {body}
      </div>
    );
  }

  return (
    <Card className={className} title="Paste a job link">
      {body}
      <div className="mt-3">
        <Link href="/pipeline?tab=INBOX" className="text-xs text-brand hover:underline">
          View pipeline inbox →
        </Link>
      </div>
    </Card>
  );
}
