"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Space, Typography } from "antd";

const { Text } = Typography;

export function DeleteFromTracker({ n }: { n: string }) {
  const router = useRouter();
  const [orphan, setOrphan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checked, setChecked] = useState(false);

  async function loadOrphan() {
    if (checked) return true;
    setErr("");
    try {
      const r = await fetch("/api/tracker/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, dryRun: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "This row can't be removed.");
        return false;
      }
      setOrphan(d.orphanReport ?? null);
      setChecked(true);
      return true;
    } catch {
      setErr("Couldn't reach the tracker.");
      return false;
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/tracker/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "Delete failed.");
        setBusy(false);
        return;
      }
      router.push("/pipeline");
      router.refresh();
    } catch {
      setErr("Delete failed.");
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" className="w-full">
      <Popconfirm
        title={`Permanently remove application #${n}?`}
        description={
          <>
            This can&apos;t be undone.
            {orphan ? ` Its report file (${orphan}) is left on disk.` : ""}
          </>
        }
        onOpenChange={(open) => {
          if (open) void loadOrphan();
        }}
        onConfirm={confirmDelete}
        okText="Delete"
        okButtonProps={{ danger: true, loading: busy }}
        disabled={!!err && checked}
      >
        <Button danger size="small" icon={<DeleteOutlined />} loading={busy}>
          Remove from tracker
        </Button>
      </Popconfirm>
      {err && <Text type="danger" className="text-xs">{err}</Text>}
    </Space>
  );
}
