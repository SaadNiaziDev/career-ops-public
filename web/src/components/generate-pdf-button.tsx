"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { CostBadge } from "@/components/cost/cost-badge";
import { useJobs } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";

export function GeneratePdfButton({
  n,
  company,
  pdfReady,
  rail = false,
}: {
  n: string;
  company: string;
  pdfReady: boolean;
  rail?: boolean;
}) {
  const { jobs, startJob } = useJobs();
  const job = useMemo(
    () => jobs.filter((j) => j.kind === "pdf" && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, n],
  );
  const generate = () =>
    startJob({
      title: `CV PDF · ${company}`,
      subtitle: "tailored for this role",
      kind: "pdf",
      input: n,
      page: `/pipeline/${n}`,
    });

  if (job?.status === "running") {
    return (
      <Link href={`/jobs/${job.id}`} className={cn(rail && "block w-full")}>
        <Md3ActionButton variant="outlined" loading className={cn(rail && "w-full")}>
          Generating CV…
        </Md3ActionButton>
      </Link>
    );
  }

  const ready = pdfReady || job?.status === "done";
  if (ready) {
    return (
      <div className={cn("md3-actions-row", rail && "w-full")}>
        <a
          href={`/api/cv-pdf?company=${encodeURIComponent(company)}`}
          target="_blank"
          rel="noreferrer"
          className={cn("md3-action-btn md3-action-btn--filled flex-1", rail && "w-full")}
        >
          <span className="material-symbols-outlined text-[18px] leading-none">description</span>
          <span className="md3-action-btn__label">View tailored CV</span>
        </a>
        <Md3ActionButton variant="outlined" icon="refresh" onClick={generate} title="Regenerate CV" aria-label="Regenerate CV" />
      </div>
    );
  }

  if (rail) {
    return (
      <Md3ActionButton variant="outlined" icon="picture_as_pdf" className="w-full" onClick={generate}>
        Generate tailored CV
      </Md3ActionButton>
    );
  }

  return (
    <div className="md3-actions-row items-center">
      <Md3ActionButton variant="outlined" icon="picture_as_pdf" cost="spend" onClick={generate}>
        Generate tailored CV (PDF)
      </Md3ActionButton>
    </div>
  );
}
