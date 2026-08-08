"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Card } from "@/components/ui/md3-card";
import { cn } from "@/lib/cn";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { AddCompanyCard } from "@/components/portals/add-company-card";

type Company = { name: string; status: string; detail: string };
type Result = { available: boolean; configured: boolean; companies: Company[] };

const TONE: Record<string, { className: string; label: string }> = {
  live: { className: "bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]", label: "live" },
  empty: { className: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]", label: "live · empty" },
  broken: { className: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]", label: "broken" },
  skipped: { className: "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]", label: "no ATS" },
};
const ORDER: Record<string, number> = { broken: 0, empty: 1, live: 2, skipped: 3 };

export function PortalsView() {
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const { jobs, startJob } = useJobs();

  const fixByCompany = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) {
      if (j.kind !== "fix-portal" || !j.input) continue;
      const ex = m.get(j.input);
      if (!ex || j.startedAt > ex.startedAt) m.set(j.input, j);
    }
    return m;
  }, [jobs]);

  function check() {
    setLoading(true);
    fetch("/api/portals/verify")
      .then((r) => r.json())
      .then(setRes)
      .catch(() => setRes({ available: false, configured: false, companies: [] }))
      .finally(() => setLoading(false));
  }

  const companies = res?.companies ?? [];
  const broken = companies.filter((c) => c.status === "broken");
  const liveN = companies.filter((c) => c.status === "live" || c.status === "empty").length;
  const sorted = [...companies].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div>
      <div className="md3-actions-row">
        <Md3ActionButton variant="filled" icon="radar" loading={loading} onClick={check}>
          Check portal health
        </Md3ActionButton>
        <AddCompanyCard onAdded={check} />
        {loading && (
          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            Probing each company&apos;s ATS… (~30–60s)
          </span>
        )}
      </div>

      {res && !res.available && (
        <p className="md3-alert md3-alert--warning mt-4">
          <code>verify-portals.mjs</code> not found — this needs a complete career-ops checkout.
        </p>
      )}
      {res && res.available && !res.configured && (
        <p className="md3-alert md3-alert--info mt-4">
          No <code>portals.yml</code> yet — set up scan keywords on the Portals page.
        </p>
      )}

      {res && res.configured && (
        <div className="mt-5">
          <p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
            <span className="text-[var(--md-sys-color-primary)]">{liveN}</span> live ·{" "}
            <span className="text-[var(--md-sys-color-error)]">{broken.length}</span> broken · {companies.length} tracked
          </p>
          {broken.length > 0 && (
            <p className="md3-alert md3-alert--error mt-3">
              {broken.length} {broken.length === 1 ? "company silently drops" : "companies silently drop"} from every
              scan — their careers link is broken. Fix the <code>careers_url</code> in <code>portals.yml</code> or use
              Fix below.
            </p>
          )}
          <Md3Card className="mt-4 !p-0">
            <ul className="divide-y divide-[var(--md-sys-color-outline-variant)]">
              {sorted.map((c) => {
                const t = TONE[c.status] ?? TONE.skipped;
                return (
                  <li key={c.name} className="flex min-h-16 flex-wrap items-center gap-3 px-[var(--card-pad-x)]">
                    <CompanyLogo name={c.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--md-sys-color-on-surface)]">{c.name}</div>
                      <code className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{c.detail}</code>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.status === "broken" ? (
                        <FixAffordance
                          job={fixByCompany.get(c.name)}
                          onFix={() =>
                            startJob({
                              title: `Fix · ${c.name}`,
                              subtitle: "repair portal slug",
                              kind: "fix-portal",
                              input: c.name,
                              page: "/portals",
                            })
                          }
                        />
                      ) : null}
                      <span className={cn("inline-flex min-h-7 items-center rounded-[var(--md-sys-shape-corner-small)] px-2.5 text-xs font-semibold", t.className)}>
                        {t.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Md3Card>
        </div>
      )}
    </div>
  );
}

function FixAffordance({ job, onFix }: { job?: Job; onFix: () => void }) {
  if (job?.status === "running") {
    return (
      <Link href={`/jobs/${job.id}`} className="md3-btn-text min-h-10 text-sm">
        <MaterialSymbol name="progress_activity" size={16} className="animate-spin" />
        Fixing…
      </Link>
    );
  }
  if (job?.status === "done") {
    return (
      <Link href={`/jobs/${job.id}`} className="md3-btn-text min-h-10 text-sm text-[var(--md-sys-color-tertiary)]">
        repaired · re-check
      </Link>
    );
  }
  return (
    <Md3ActionButton variant="outlined" icon="build" onClick={onFix}>
      Fix
    </Md3ActionButton>
  );
}
