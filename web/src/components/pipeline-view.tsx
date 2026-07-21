"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, Input, Table, Tabs, Tag, Typography, Empty, Button } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { CompassOutlined, CloseOutlined } from "@ant-design/icons";
import type { Application, InboxJob } from "@/lib/career-ops";
import { CompanyLogo } from "@/components/company-logo";
import { canonStatus, scoreNum, scoreTone, statusDot } from "@/lib/format";
import { InboxTriage } from "@/components/inbox/inbox-triage";
import { PipelineRowActions } from "@/components/pipeline/pipeline-row-actions";
import { DossierHero } from "@/components/dossier/dossier-hero";
import { PageShell } from "@/components/dossier/page-shell";
import { cn } from "@/lib/cn";

const TABS = [
  "INBOX",
  "ALL",
  "EVALUATED",
  "APPLIED",
  "RESPONDED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "DISCARDED",
  "SKIP",
] as const;
type Tab = (typeof TABS)[number];

const SORT_KEYS = ["company", "role", "score", "status", "date"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const SCORE_TONE: Record<string, string> = {
  good: "success",
  warn: "warning",
  bad: "error",
  muted: "default",
};

export function PipelineView({
  applications,
  inbox,
}: {
  applications: Application[];
  inbox: InboxJob[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const pTab = (params.get("tab") ?? "").toUpperCase();
  const tab: Tab = (TABS as readonly string[]).includes(pTab) ? (pTab as Tab) : "INBOX";
  const pMin = parseFloat(params.get("min") ?? "");
  const minFilter: number | null = Number.isFinite(pMin) ? pMin : null;
  const pSort = params.get("sort") ?? "";
  const sortKey: SortKey = (SORT_KEYS as readonly string[]).includes(pSort) ? (pSort as SortKey) : "score";
  const sortDir = params.get("dir") === "1" ? 1 : -1;

  const [q, setQ] = useState(params.get("q") ?? "");
  const lastUrlQ = useRef(params.get("q") ?? "");
  useEffect(() => {
    const urlQ = params.get("q") ?? "";
    if (urlQ !== lastUrlQ.current) {
      lastUrlQ.current = urlQ;
      setQ(urlQ);
    }
  }, [params]);

  const setParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, String(v));
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, router, pathname],
  );

  const pendingInbox = useMemo(() => {
    const seen = new Set<string>();
    const out: InboxJob[] = [];
    for (const j of inbox) {
      if (j.done || seen.has(j.url)) continue;
      seen.add(j.url);
      out.push(j);
    }
    return out;
  }, [inbox]);

  const stats = useMemo(() => {
    const has = (r: Application, s: string) => canonStatus(r.status).includes(s);
    const scores = applications.map((r) => scoreNum(r.score)).filter((n) => !Number.isNaN(n));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const applyReady = applications.filter(
      (r) => has(r, "EVALUATED") && !Number.isNaN(scoreNum(r.score)) && scoreNum(r.score) >= 4.0,
    ).length;
    const applied = applications.filter((r) => has(r, "APPLIED")).length;
    const responded = applications.filter(
      (r) => has(r, "RESPONDED") || has(r, "INTERVIEW") || has(r, "OFFER"),
    ).length;
    const interviews = applications.filter((r) => has(r, "INTERVIEW")).length;
    const offers = applications.filter((r) => has(r, "OFFER")).length;
    const responseRate = applied > 0 ? Math.round((responded / applied) * 100) : null;
    return { avg, applyReady, applied, responseRate, interviews, offers };
  }, [applications]);

  const filtered = useMemo(() => {
    if (tab === "INBOX") return [];
    let rows = applications;
    if (tab !== "ALL") rows = rows.filter((r) => canonStatus(r.status).includes(tab));
    if (minFilter != null) {
      rows = rows.filter((r) => {
        const n = scoreNum(r.score);
        return !Number.isNaN(n) && n >= minFilter;
      });
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => `${r.company} ${r.role}`.toLowerCase().includes(needle));
    }
    return [...rows].sort((a, b) => {
      if (sortKey === "score") {
        const an = scoreNum(a.score);
        const bn = scoreNum(b.score);
        const av = Number.isNaN(an) ? -Infinity : an;
        const bv = Number.isNaN(bn) ? -Infinity : bn;
        return (av - bv) * sortDir;
      }
      return (a[sortKey] || "").localeCompare(b[sortKey] || "") * sortDir;
    });
  }, [applications, tab, q, sortKey, sortDir, minFilter]);

  const tabItems = TABS.map((t) => {
    const count =
      t === "INBOX"
        ? pendingInbox.length
        : t === "ALL"
          ? applications.length
          : applications.filter((r) => canonStatus(r.status).includes(t)).length;
    return {
      key: t,
      label: (
        <span>
          {t} <Typography.Text type="secondary" className="text-xs tabular-nums">{count}</Typography.Text>
        </span>
      ),
    };
  });

  const columns: ColumnsType<Application> = [
    {
      title: "Company",
      dataIndex: "company",
      sorter: true,
      sortOrder: sortKey === "company" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (company: string, row) => (
        <Link href={`/pipeline/${row.n}`} className="inline-flex items-center gap-2 font-medium hover:text-brand">
          <CompanyLogo name={company} size={20} />
          {company}
        </Link>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      sorter: true,
      sortOrder: sortKey === "role" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (role: string, row) => (
        <Link href={`/pipeline/${row.n}`} className="text-muted hover:text-brand">
          {role}
        </Link>
      ),
    },
    {
      title: "Score",
      dataIndex: "score",
      width: 96,
      sorter: true,
      sortOrder: sortKey === "score" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (score: string) => {
        const tone = scoreTone(score);
        return <Tag color={SCORE_TONE[tone]}>{score || "—"}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: true,
      sortOrder: sortKey === "status" ? (sortDir === 1 ? "ascend" : "descend") : null,
      render: (status: string) => (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className={cn("size-1.5 shrink-0 rounded-full", statusDot(status))} />
          {status}
        </span>
      ),
    },
    {
      title: "Date",
      dataIndex: "date",
      width: 112,
      sorter: true,
      sortOrder: sortKey === "date" ? (sortDir === 1 ? "ascend" : "descend") : null,
      className: "tabular-nums text-faint",
    },
    {
      title: "",
      key: "actions",
      width: 48,
      render: (_, row) => <PipelineRowActions n={row.n} company={row.company} role={row.role} />,
    },
  ];

  const onTableChange: TableProps<Application>["onChange"] = (_pag, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const col = (s?.columnKey ?? s?.field) as SortKey | undefined;
    if (!col || !(SORT_KEYS as readonly string[]).includes(col)) return;
    const dir = s?.order === "ascend" ? 1 : -1;
    setParams({ sort: col, dir });
  };

  return (
    <PageShell width="6xl">
      <DossierHero
        className="mb-4"
        eyebrow="Pipeline"
        title="Applications & inbox"
        description={
          <>
            <span className="tabular-nums">{pendingInbox.length}</span> in inbox ·{" "}
            <span className="tabular-nums">{applications.length}</span> tracked
          </>
        }
        actions={
          tab !== "INBOX" ? undefined : (
            <Link href="/explore?run=1">
              <Button type="primary" icon={<CompassOutlined />}>
                Run free scan
              </Button>
            </Link>
          )
        }
        footer={
          tab !== "INBOX" ? (
            <Input.Search
              allowClear
              placeholder="Search company or role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
          ) : undefined
        }
      />

      {tab !== "INBOX" && applications.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Avg score" value={stats.avg != null ? stats.avg.toFixed(1) : "—"} />
          <StatTile
            label="Apply-ready"
            value={stats.applyReady}
            tone="brand"
            onClick={() => setParams({ tab: "EVALUATED", min: 4 })}
          />
          <StatTile label="Applied" value={stats.applied} onClick={() => setParams({ tab: "APPLIED", min: null })} />
          <StatTile label="Response rate" value={stats.responseRate != null ? `${stats.responseRate}%` : "—"} />
          <StatTile
            label="Interviews"
            value={stats.interviews}
            onClick={() => setParams({ tab: "INTERVIEW", min: null })}
          />
          <StatTile label="Offers" value={stats.offers} onClick={() => setParams({ tab: "OFFER", min: null })} />
        </div>
      )}

      <Tabs
        activeKey={tab}
        onChange={(k) => setParams({ tab: k === "INBOX" ? null : k })}
        items={tabItems}
        className="pipeline-tabs"
      />

      {tab !== "INBOX" && minFilter != null && (
        <div className="mb-3">
          <Tag
            closable
            onClose={() => setParams({ min: null })}
            closeIcon={<CloseOutlined />}
            color="processing"
          >
            score ≥ {minFilter.toFixed(1)}
          </Tag>
        </div>
      )}

      {tab === "INBOX" ? (
        pendingInbox.length > 0 ? (
          <InboxTriage inbox={pendingInbox} />
        ) : (
          <InboxEmpty count={0} filtered={false} />
        )
      ) : filtered.length > 0 ? (
        <Card className="mt-2" bodyStyle={{ padding: 0 }}>
          <Table
            rowKey={(r) => r.n}
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 25, showSizeChanger: false }}
            onChange={onTableChange}
            size="middle"
          />
        </Card>
      ) : (
        <Card className="mt-4">
          <Empty description="No matches — try another tab or clear the search." />
        </Card>
      )}
    </PageShell>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "brand";
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className={cn("text-2xl font-semibold tabular-nums", tone === "brand" && "text-brand")}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-faint">{label}</div>
    </>
  );
  const base = "rounded-2xl border border-border bg-surface/50 p-4 text-left";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, "cursor-pointer transition-colors hover:border-brand/40 hover:bg-surface-hover")}
      >
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

function InboxEmpty({ count, filtered }: { count: number; filtered: boolean }) {
  if (filtered) {
    return (
      <Card className="mt-4">
        <Empty description="Clear the search to see the full inbox." />
      </Card>
    );
  }
  return (
    <Card className="dot-bg mt-4 overflow-hidden border-brand/20 bg-linear-to-tr from-brand/10 via-transparent to-transparent">
      <div className="px-6 py-10 text-center">
        <Typography.Title level={4}>
          Your <span className="text-brand">inbox</span> is empty
        </Typography.Title>
        {count > 0 ? (
          <Typography.Paragraph type="secondary">Nothing pending right now.</Typography.Paragraph>
        ) : (
          <>
            <Typography.Paragraph type="secondary" className="mx-auto max-w-sm">
              Find roles that match your CV — free, no tokens spent.
            </Typography.Paragraph>
            <Link href="/explore?run=1">
              <Button type="primary" icon={<CompassOutlined />} className="mt-2">
                Run your first free scan
              </Button>
            </Link>
            <Typography.Paragraph type="secondary" className="mx-auto mt-4 max-w-sm text-xs">
              Or add job URLs to <code>data/pipeline.md</code>
            </Typography.Paragraph>
          </>
        )}
      </div>
    </Card>
  );
}
