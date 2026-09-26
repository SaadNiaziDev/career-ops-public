"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Md3Card } from "@/components/ui/md3-card";
import { scoreNum, scoreTone } from "@/lib/format";
import type { Application } from "@/lib/career-ops";

export function DecisionCard({ app }: { app: Application }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "Applied" | "Discarded">("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const score = scoreNum(app.score);
  const tone = scoreTone(app.score);

  const setStatus = async (status: "Applied" | "Discarded") => {
    if (status === "Applied" && !window.confirm("Have you submitted the application? This only records an application you have sent.")) return;
    let overrideReason: string | undefined;
    if (status === "Applied" && Number.isFinite(score) && score < 4) {
      overrideReason = window.prompt("This role scored below 4.0. Why do you want to apply anyway?")?.trim();
      if (!overrideReason) return;
    }
    setBusy(status);
    setError(null);
    try {
      const response = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: app.n, status, overrideReason, confirmedSubmission: status === "Applied" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update application status. Please retry.");
      setDone(status);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update application status. Please retry.");
    } finally {
      setBusy("");
    }
  };

  if (done) return null;

  return (
    <Md3Card className="dossier-decision-card h-full !p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <CompanyLogo name={app.company} size={24} />
        <div className="min-w-0 flex-1">
          <p className="truncate md-title-small text-[var(--md-sys-color-on-surface)]">{app.company}</p>
          <p className="truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">{app.role}</p>
        </div>
        {Number.isFinite(score) && score > 0 && <Badge tone={tone}>{app.score}</Badge>}
      </div>
      <div className="md3-actions-row">
        <Link href={`/pipeline/${app.n}`} className="md3-action-btn md3-action-btn--filled">{score >= 4 ? "Review & prepare" : "Review role"}</Link>
        <Md3ActionButton variant={score >= 4 ? "outlined" : "filled"} icon="close" loading={busy === "Discarded"} disabled={!!busy} onClick={() => void setStatus("Discarded")}>
          Skip
        </Md3ActionButton>
        <Md3ActionButton variant="outlined" icon="check" loading={busy === "Applied"} disabled={!!busy} onClick={() => void setStatus("Applied")}>{score < 4 ? "Confirm submitted anyway" : "Confirm submitted"}</Md3ActionButton>
        <Link href={`/pipeline/${app.n}`} className="md3-action-btn md3-action-btn--text" aria-label="Open report">
          <span className="material-symbols-outlined text-[18px] leading-none">description</span>
        </Link>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-[var(--md-sys-color-error)]">{error}</p>}
    </Md3Card>
  );
}
