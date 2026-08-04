"use client";

import { useState } from "react";
import { CostBadge } from "@/components/cost/cost-badge";
import { useJobs } from "@/components/jobs/job-store";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Input } from "@/components/ui/md3-input";

// Auto-pipeline, one click: paste a job URL → fire a real evaluation worker
// (the same kind:"evaluate" that runs modes/oferta.md + writes the A–F report +
// tracker row). The worker pills + assistant cards show progress.
export function QuickEvaluate() {
  const { startJob } = useJobs();
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");

  function run() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      setHint("Paste a full job-posting URL (https://…).");
      return;
    }
    startJob({ title: "Evaluate · pasted URL", subtitle: u, kind: "evaluate", input: u, page: "/" });
    setUrl("");
    setHint("Evaluating — watch it in the Workers tray.");
  }

  return (
    <div className="mt-7">
      <div className="flex max-w-xl items-center gap-2">
        <Md3Input
          icon="auto_awesome"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (hint) setHint("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="Paste a job URL to evaluate…"
          className="min-w-0 flex-1"
        />
        <Md3ActionButton variant="filled" icon="bolt" cost="spend" onClick={run}>
          Evaluate
        </Md3ActionButton>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CostBadge kind="spend" size="xs" />
        <span className="text-xs text-[var(--md-sys-color-outline)]">
          Evaluation runs on your own AI — your key, your machine.
        </span>
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--md-sys-color-outline)]">{hint}</p> : null}
    </div>
  );
}
