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
  const score = scoreNum(app.score);
  const tone = scoreTone(app.score);

  const setStatus = async (status: "Applied" | "Discarded") => {
    setBusy(status);
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: app.n, status }),
      });
      setDone(status);
      router.refresh();
    } catch {
      /* ignore */
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
        <Md3ActionButton variant="filled" icon="check" loading={busy === "Applied"} disabled={!!busy} onClick={() => setStatus("Applied")}>
          Mark applied
        </Md3ActionButton>
        <Md3ActionButton variant="outlined" icon="close" loading={busy === "Discarded"} disabled={!!busy} onClick={() => setStatus("Discarded")}>
          Skip
        </Md3ActionButton>
        <Link href={`/pipeline/${app.n}`} className="md3-action-btn md3-action-btn--text" aria-label="Open report">
          <span className="material-symbols-outlined text-[18px] leading-none">description</span>
        </Link>
      </div>
    </Md3Card>
  );
}
