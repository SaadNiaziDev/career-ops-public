"use client";

import { useMemo, useState } from "react";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Input, Segmented, Space, Typography } from "antd";
import type { DiscoveredOffer } from "@/lib/explore";
import { CostBadge } from "@/components/cost/cost-badge";
import { DiscoveryCard } from "./discovery-card";
import { useExplore } from "./explore-provider";

const { Text, Paragraph } = Typography;

export type EnrichedOffer = DiscoveredOffer & { inPipeline: boolean; evaluatedN?: string };

export function ResultsList({ offers }: { offers: EnrichedOffer[] }) {
  const { companiesScanned, partial, addToPipeline, added, mode } = useExplore();
  const isAi = mode === "ai";
  const [sort, setSort] = useState<"fresh" | "company">("fresh");
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = offers;
    if (needle) list = list.filter((o) => o.title.toLowerCase().includes(needle) || o.company.toLowerCase().includes(needle));
    const sorted = [...list].sort((a, b) =>
      sort === "fresh" ? (b.postedAt || "").localeCompare(a.postedAt || "") : a.company.localeCompare(b.company),
    );
    return sorted;
  }, [offers, q, sort]);

  const addable = offers.filter((o) => !o.inPipeline && !o.evaluatedN && !added.has(o.url));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <Paragraph className="!mb-0">
            <Text strong>{offers.length}</Text>{" "}
            {isAi ? `candidate${offers.length === 1 ? "" : "s"}` : `fresh role${offers.length === 1 ? "" : "s"}`}
            <CostBadge kind={isAi ? "spend" : "free-network"} size="xs" className="ml-2 align-middle" />
          </Paragraph>
          <Text type="secondary" className="text-xs">
            {isAi
              ? "found by AI on the open web · unverified until you evaluate"
              : `${companiesScanned > 0 ? `${companiesScanned.toLocaleString()} companies scanned · ` : ""}0 tokens spent${partial ? " · some boards were unreachable (normal for public directories)" : ""}`}
          </Text>
        </div>

        <Space wrap className="ml-auto">
          <Input
            prefix={<SearchOutlined />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter results…"
            allowClear
            className="w-40"
            size="small"
          />
          <Segmented
            size="small"
            value={sort}
            onChange={(v) => setSort(v as "fresh" | "company")}
            options={[
              { label: "Fresh", value: "fresh" },
              { label: "Company", value: "company" },
            ]}
          />
          {addable.length > 1 && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => addToPipeline(addable)}>
              Add all {addable.length}
            </Button>
          )}
        </Space>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {view.map((o) => (
          <DiscoveryCard key={o.url} offer={o} inPipeline={o.inPipeline} evaluatedN={o.evaluatedN} />
        ))}
      </div>
    </div>
  );
}
