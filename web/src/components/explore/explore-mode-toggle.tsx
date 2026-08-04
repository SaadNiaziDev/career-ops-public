"use client";

import { CompassOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Segmented, Space, Typography } from "antd";
import { CostBadge } from "@/components/cost/cost-badge";
import type { ExploreMode } from "@/lib/explore";

const { Text } = Typography;

export function ExploreModeToggle({
  mode,
  onChange,
  cliConfigured,
}: {
  mode: ExploreMode;
  onChange: (m: ExploreMode) => void;
  cliConfigured: boolean;
}) {
  return (
    <Space direction="vertical" size={4} className="w-full sm:w-auto">
      <Segmented
        value={mode}
        onChange={(v) => onChange(v as ExploreMode)}
        options={[
          {
            label: (
              <Space size={6}>
                <CompassOutlined />
                <span>Scan</span>
                <CostBadge kind="free-network" size="xs" />
              </Space>
            ),
            value: "scan",
          },
          {
            label: (
              <Space size={6}>
                <ThunderboltOutlined />
                <span>AI search</span>
                <CostBadge kind="spend" size="xs" />
              </Space>
            ),
            value: "ai",
          },
        ]}
        block
        className="sm:!inline-flex sm:!w-auto"
      />
      {!cliConfigured && mode === "ai" && (
        <Text type="secondary" className="text-xs">
          needs a CLI
        </Text>
      )}
    </Space>
  );
}
