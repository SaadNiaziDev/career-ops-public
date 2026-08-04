"use client";

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Collapse, Typography } from "antd";
import Link from "next/link";

const { Text, Paragraph } = Typography;

const DIMENSIONS: [string, string][] = [
  ["Match", "CV vs role requirements"],
  ["Career fit", "Alignment with your goals"],
  ["Comp", "Offer vs market (when data exists)"],
  ["Culture", "Team and ways of working"],
  ["Red flags", "Ghost jobs, scams, mismatches"],
  ["Overall", "Combined judgment → score"],
];

export function ScoreMethodology() {
  return (
    <Collapse
      ghost
      size="small"
      items={[
        {
          key: "methodology",
          label: (
            <Text type="secondary" className="text-xs">
              <QuestionCircleOutlined className="mr-1.5" />
              How scoring works
            </Text>
          ),
          children: (
            <div className="dossier-inset-stack pb-1">
              <Paragraph type="secondary" className="mb-0! text-xs leading-relaxed">
                Roles score <Text strong>1.0–5.0</Text>. <Text strong>4.0</Text> is the apply line — below it,
                career-ops recommends passing unless you have a specific reason.
              </Paragraph>
              <ul className="m-0 list-disc space-y-1 pl-4 text-xs text-[var(--ant-color-text-secondary)]">
                {DIMENSIONS.map(([k, v]) => (
                  <li key={k}>
                    <Text strong className="text-xs">
                      {k}
                    </Text>{" "}
                    — {v}
                  </li>
                ))}
              </ul>
              <Link href="https://career-ops.org/methodology" target="_blank" rel="noreferrer" className="text-xs">
                Full methodology →
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}
