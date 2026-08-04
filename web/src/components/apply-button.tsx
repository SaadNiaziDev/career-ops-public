"use client";

import { useRouter } from "next/navigation";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useJobs } from "@/components/jobs/job-store";
import { useApply } from "@/components/apply/apply-provider";
import { cn } from "@/lib/cn";

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
      <Md3ActionButton variant="outlined" disabled className={cn(rail && "w-full")} title={reason} icon="lock">
        Apply
      </Md3ActionButton>
    );
  }

  return (
    <Md3ActionButton
      variant="filled"
      icon="send"
      className={cn(rail && "w-full")}
      onClick={() => {
        apply.open(url!, { prefill: true, company });
        router.push("/apply");
      }}
    >
      Apply
    </Md3ActionButton>
  );
}
