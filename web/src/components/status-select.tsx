"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckOutlined } from "@ant-design/icons";
import { Select, Space, Typography } from "antd";
import { CANONICAL_STATES } from "@/lib/format";

const { Text } = Typography;

export function StatusSelect({ n, current }: { n: string; current: string }) {
  const [status, setStatus] = useState(current);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onChange(next: string) {
    const prev = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, status: next }),
      });
      if (!res.ok) throw new Error("write failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  const known = (CANONICAL_STATES as readonly string[]).includes(status);
  const options = [
    ...(!known ? [{ value: status, label: status }] : []),
    ...CANONICAL_STATES.map((s) => ({ value: s, label: s })),
  ];

  return (
    <Space size={8}>
      <Select
        value={status}
        onChange={onChange}
        disabled={busy}
        options={options}
        size="small"
        style={{ minWidth: 120 }}
      />
      {saved && (
        <Text type="success" className="text-xs">
          <CheckOutlined /> saved
        </Text>
      )}
    </Space>
  );
}
