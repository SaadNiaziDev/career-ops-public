"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Alert,
} from "antd";
import { CompassOutlined, LoadingOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useJobs } from "@/components/jobs/job-store";
import type { TitleSuggestion } from "@/lib/titles";

const AXIS_COLOR: Record<string, string> = {
  Lateral: "green",
  Stretch: "orange",
  Pivot: "purple",
};

type Props = {
  compact?: boolean;
};

export function TitlesBroadening({ compact = false }: Props) {
  const { jobs, startJob } = useJobs();
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const running = useMemo(
    () => jobs.some((j) => j.kind === "titles" && j.status === "running"),
    [jobs],
  );

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/titles")
      .then((r) => r.json())
      .then((d) => {
        setSuggestions(Array.isArray(d.suggestions?.suggestions) ? d.suggestions.suggestions : []);
        setGeneratedAt(d.suggestions?.generatedAt ?? null);
        setKeywords(Array.isArray(d.keywords) ? d.keywords : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onDone = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail?.kind === "titles") load();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [load]);

  const keywordLower = useMemo(() => new Set(keywords.map((k) => k.toLowerCase())), [keywords]);

  const rows = useMemo(
    () =>
      suggestions.map((s, i) => ({
        key: `${s.keyword}-${i}`,
        ...s,
        already: keywordLower.has((s.keyword || s.title).toLowerCase()),
      })),
    [suggestions, keywordLower],
  );

  const runTitles = () => {
    const id = startJob({
      title: "Broaden search titles",
      subtitle: "CV-driven adjacent roles",
      kind: "titles",
      input: "broaden",
      page: "/portals",
    });
    if (id) message.info("Analyzing your CV for adjacent titles — check Workers for progress.");
  };

  const toggle = (keyword: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(keyword);
      else next.delete(keyword);
      return next;
    });
  };

  const applySelected = async () => {
    const kws = [...selected];
    if (kws.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch("/api/portals/append-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kws }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      message.success(`Added ${data.added?.length ?? kws.length} keyword(s) to portals.yml`);
      setSelected(new Set());
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Could not update portals.yml");
    } finally {
      setApplying(false);
    }
  };

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: "",
      width: 44,
      render: (_, row) =>
        row.already ? (
          <Tag>active</Tag>
        ) : (
          <Checkbox
            checked={selected.has(row.keyword)}
            onChange={(e) => toggle(row.keyword, e.target.checked)}
          />
        ),
    },
    {
      title: "Title",
      dataIndex: "title",
      render: (t: string, row) => (
        <div>
          <Typography.Text strong>{t}</Typography.Text>
          <div>
            <Typography.Text type="secondary" className="text-xs">
              keyword: {row.keyword}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "Axis",
      dataIndex: "axis",
      width: 96,
      render: (a: string) => <Tag color={AXIS_COLOR[a] ?? "default"}>{a}</Tag>,
    },
    {
      title: "Evidence",
      dataIndex: "evidence",
      ellipsis: true,
      responsive: ["md"],
    },
    {
      title: "Gap",
      dataIndex: "gap",
      ellipsis: true,
      responsive: ["lg"],
    },
  ];

  if (compact) {
    return (
      <Card
        id="titles"
        size="small"
        title="Broaden your search"
        extra={
          <Link href="/portals#titles" className="text-xs text-brand">
            Manage →
          </Link>
        }
      >
        <Typography.Paragraph type="secondary" className="!mb-3 text-sm">
          Your scanner only finds roles matching <code>title_filter.positive</code>. Discover adjacent titles from your CV.
        </Typography.Paragraph>
        <Space wrap>
          <Typography.Text type="secondary" className="text-xs">
            {keywords.length} active keywords
            {generatedAt ? ` · last run ${generatedAt}` : ""}
          </Typography.Text>
          <Button size="small" icon={running ? <LoadingOutlined /> : <ReloadOutlined />} onClick={runTitles} disabled={running}>
            Suggest titles
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card
      id="titles"
      title="Broaden search titles"
      extra={
        <Button type="primary" icon={running ? <LoadingOutlined /> : <PlusOutlined />} onClick={runTitles} disabled={running}>
          Analyze CV for adjacent titles
        </Button>
      }
      className="mt-5"
    >
      <Typography.Paragraph type="secondary">
        The free scanner matches <code>portals.yml</code> keywords only. This reads your CV and suggests adjacent market titles —
        you pick which keywords to add. Nothing is written until you confirm.
      </Typography.Paragraph>

      {keywords.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {keywords.slice(0, 12).map((k) => (
            <Tag key={k}>{k}</Tag>
          ))}
          {keywords.length > 12 && <Tag>+{keywords.length - 12} more</Tag>}
        </div>
      )}

      {generatedAt && (
        <Typography.Text type="secondary" className="mb-3 block text-xs">
          Last generated {generatedAt}
        </Typography.Text>
      )}

      <Table
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={rows.length > 8 ? { pageSize: 8 } : false}
        locale={{ emptyText: <Empty description="Run the analyzer to get CV-driven title suggestions" /> }}
      />

      {selected.size > 0 && (
        <Alert
          className="mt-4"
          type="info"
          showIcon
          message={
            <Space wrap>
              <span>
                Add <strong>{selected.size}</strong> keyword{selected.size === 1 ? "" : "s"} to portals.yml?
              </span>
              <Button type="primary" size="small" loading={applying} onClick={applySelected}>
                Confirm &amp; append
              </Button>
              <Link href="/explore?run=1">
                <Button size="small" icon={<CompassOutlined />}>
                  Re-scan after adding
                </Button>
              </Link>
            </Space>
          }
        />
      )}
    </Card>
  );
}
