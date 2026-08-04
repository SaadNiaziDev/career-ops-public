"use client";

import { useRouter } from "next/navigation";
import { LockOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useJobs } from "@/components/jobs/job-store";
import { useApply } from "@/components/apply/apply-provider";

export function ApplyButton({
  n,
  url,
  company,
  pdfReady,
  rail = false,
}: {
  n: string;
  url?: string;
  company: string;
  pdfReady: boolean;
  rail?: boolean;
}) {
  const router = useRouter();
  const { jobs } = useJobs();
  const apply = useApply();

  const pdfJobDone = jobs.some((j) => j.kind === "pdf" && j.input === n && j.status === "done");
  const hasUrl = !!url && /^https?:\/\//i.test(url);
  const ready = (pdfReady || pdfJobDone) && hasUrl;

  if (!ready) {
    const reason = !hasUrl ? "No application URL on this report" : "Generate the tailored CV first";
    return (
      <Tooltip title={reason}>
        <Button block={rail} disabled icon={<LockOutlined />}>
          Apply
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button
      block={rail}
      type="primary"
      icon={<SendOutlined />}
      className="bg-[var(--brand)] hover:opacity-90"
      onClick={() => {
        apply.open(url!, { prefill: true, company });
        router.push("/apply");
      }}
    >
      Apply
    </Button>
  );
}
