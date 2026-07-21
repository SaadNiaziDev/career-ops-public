"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, Input, Tag, Typography, Empty, Button, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, LinkOutlined } from "@ant-design/icons";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierHero } from "@/components/dossier/dossier-hero";

export type ContactRow = {
  date: string;
  trackerNum: string;
  company: string;
  role: string;
  name: string;
  title: string;
  channel: string;
  email: string;
  linkedin: string;
  verified: string;
  source: string;
  notes: string;
};

export function ContactsView({ initial }: { initial: ContactRow[] }) {
  const [q, setQ] = useState("");
  const [rows] = useState(initial);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.company, r.role, r.name, r.title, r.email, r.notes].some((f) => f.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const columns: ColumnsType<ContactRow> = [
    {
      title: "Role",
      key: "role",
      render: (_, r) => (
        <div>
          <Link href={`/pipeline/${r.trackerNum}`} className="font-medium text-brand-text hover:underline">
            {r.company}
          </Link>
          <div className="text-xs text-muted">{r.role}</div>
          <Tag className="!mt-1" color="default">
            #{r.trackerNum}
          </Tag>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.name || "—"}</div>
          <div className="text-xs text-muted">{r.title || r.channel}</div>
        </div>
      ),
    },
    {
      title: "Reach",
      key: "reach",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.email ? (
            <a href={`mailto:${r.email}`} className="text-sm">
              {r.email}
            </a>
          ) : (
            <span className="text-faint text-xs">No email found</span>
          )}
          {r.linkedin?.startsWith("http") && (
            <a href={r.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-text">
              LinkedIn <LinkOutlined />
            </a>
          )}
          {r.verified && (
            <Tag color={r.verified === "yes" ? "green" : "default"} className="!mt-1">
              {r.verified}
            </Tag>
          )}
        </Space>
      ),
    },
    { title: "Date", dataIndex: "date", width: 110, responsive: ["md"] },
    {
      title: "Notes",
      dataIndex: "notes",
      ellipsis: true,
      responsive: ["lg"],
      render: (v: string) => <span className="text-xs text-muted">{v}</span>,
    },
  ];

  return (
    <PageShell width="6xl">
      <DossierHero
        eyebrow="Outreach ledger"
        title="Contacts & applications memory"
        description="Every application lives in your tracker. Contacts discovered via Find contacts are logged here — linked to the role they belong to."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          prefix={<SearchOutlined className="text-faint" />}
          placeholder="Search company, name, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          allowClear
          className="max-w-md"
        />
        <Link href="/pipeline">
          <Button type="default">Open pipeline</Button>
        </Link>
      </div>

      <Table
        rowKey={(r) => `${r.trackerNum}-${r.name}-${r.email}-${r.date}`}
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 12, showSizeChanger: false }}
        locale={{
          emptyText: (
            <Empty description="No contacts yet">
              <Typography.Text type="secondary">
                Open a report → <strong>Find contacts</strong> to discover recruiters and save outreach drafts.
              </Typography.Text>
            </Empty>
          ),
        }}
      />
    </PageShell>
  );
}
