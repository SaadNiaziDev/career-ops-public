"use client";

import Link from "next/link";
import type { Application, DimensionTrend } from "@/lib/career-ops";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierSection } from "@/components/dossier/dossier-section";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { Md3Card } from "@/components/ui/md3-card";
import { MaterialSymbol } from "@/components/material-symbol";
import { canonStatus, scoreNum } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Outcomes needed before patterns-signals.mjs will bias scan ranking. */
const LEARNING_THRESHOLD = 5;

const STAGES: { key: string; label: string }[] = [
  { key: "EVALUATED", label: "Evaluated" },
  { key: "APPLIED", label: "Applied" },
  { key: "RESPONDED", label: "Responded" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "OFFER", label: "Offer" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DISCARDED", label: "Discarded" },
];

function BarRow({
  label,
  value,
  pct,
  total,
  fill = "secondary",
}: {
  label: string;
  value: number;
  pct: number;
  total?: number;
  fill?: "secondary" | "primary";
}) {
  const share = total && total > 0 ? Math.round((value / total) * 100) : null;
  const fillClass =
    fill === "primary"
      ? "bg-[var(--md-sys-color-primary)]"
      : "bg-[var(--md-sys-color-secondary-container)]";

  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-[120px] shrink-0 truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">{label}</span>
      <div className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)]">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-[var(--md-sys-shape-corner-medium)]", fillClass)}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums md-body-medium text-[var(--md-sys-color-on-surface)]">
        {value}
        {share !== null && <span className="ml-1 md-body-small text-[var(--md-sys-color-on-surface-variant)]">{share}%</span>}
      </span>
    </div>
  );
}

export function AnalyticsView({
  applications,
  dimensionTrends = [],
  rankingSignals = null,
}: {
  applications: Application[];
  dimensionTrends?: DimensionTrend[];
  rankingSignals?: { sample_size: number; insights: string[] } | null;
}) {
  const total = applications.length;

  const stageCounts = STAGES.map((s) => ({
    ...s,
    n: applications.filter((a) => canonStatus(a.status).includes(s.key)).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  const scores = applications.map((a) => scoreNum(a.score)).filter((n) => !Number.isNaN(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buckets = [
    { label: "4.5 – 5.0", test: (n: number) => n >= 4.5 },
    { label: "4.0 – 4.4", test: (n: number) => n >= 4 && n < 4.5 },
    { label: "3.0 – 3.9", test: (n: number) => n >= 3 && n < 4 },
    { label: "< 3.0", test: (n: number) => n < 3 },
  ].map((b) => ({ label: b.label, n: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const companyCounts = new Map<string, number>();
  for (const a of applications) if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCompany = Math.max(1, ...topCompanies.map((c) => c[1]));

  const offers = stageCounts.find((s) => s.key === "OFFER")?.n ?? 0;
  const interviews = stageCounts.find((s) => s.key === "INTERVIEW")?.n ?? 0;

  // Outcomes the ranker can learn from — a reply of any kind, not an evaluation.
  const OUTCOME_STAGES = ["RESPONDED", "INTERVIEW", "OFFER", "REJECTED"];
  const outcomes = applications.filter((a) => OUTCOME_STAGES.some((s) => canonStatus(a.status).includes(s))).length;
  const learned = Math.min(LEARNING_THRESHOLD, rankingSignals?.sample_size ?? outcomes);

  return (
    <PageShell width="default" className="max-w-[900px]">
      <DossierStack>
        {/* S10 · gap 1: Export CSV used to exist only in the command palette.
            It belongs in the header, where the data it exports is. */}
        <div data-co-tour="analytics-hero">
        <DossierPageHeader
          title="Analytics"
          description={`Across ${total} tracked evaluations.`}
          extra={
            <a href="/api/export?kind=tracker" className="md3-btn-outlined min-h-10" download>
              <MaterialSymbol name="download" size={18} />
              Export CSV
            </a>
          }
        />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-co-tour="analytics-stats">
          <DossierStat title="evaluated" value={total} />
          <Md3Card>
            <p className="dossier-stat-title mb-1">avg score</p>
            <p className="text-[28px] tabular-nums text-[var(--md-sys-color-on-surface)]">{avg ? avg.toFixed(2) : "—"}</p>
          </Md3Card>
          <DossierStat
            title="interviews"
            value={interviews}
            href={interviews === 0 ? "/" : undefined}
            accent={interviews === 0 ? "muted" : "default"}
          />
          <DossierStat title="offers" value={offers} accent={offers > 0 ? "brand" : "muted"} />
        </div>

        {interviews === 0 && (
          <Link href="/" className="block md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            Interviews follow replies — keep follow-ups warm
          </Link>
        )}

        <div data-co-tour="analytics-stages">
        <DossierSection title="Pipeline by stage">
          {stageCounts.map((s) => (
            <BarRow
              key={s.key}
              label={s.label}
              value={s.n}
              pct={(s.n / maxStage) * 100}
              total={total}
              fill={s.key === "OFFER" ? "primary" : "secondary"}
            />
          ))}
        </DossierSection>
        </div>

        <DossierSection title="Score distribution">
          {buckets.map((b) => (
            <BarRow key={b.label} label={b.label} value={b.n} pct={(b.n / maxBucket) * 100} total={scores.length} />
          ))}
        </DossierSection>

        {dimensionTrends.length > 0 && (
          <DossierSection title="Dimension trends (structured reports)">
            {dimensionTrends.map((d) => (
              <BarRow
                key={d.key}
                label={`${d.label} (n=${d.count})`}
                value={Math.round(d.avg * 10) / 10}
                pct={(d.avg / 5) * 100}
              />
            ))}
          </DossierSection>
        )}

        {/* S10 · gap 4: the learning card used to vanish below 5 outcomes without
            saying so. Under the threshold it states the progress toward it. */}
        {learned >= LEARNING_THRESHOLD && rankingSignals ? (
          <Md3Card title="System learning">
            <p className="mb-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              {rankingSignals.sample_size} tracked outcomes → scan ranking adjusts toward responding segments.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--md-sys-color-on-surface)]">
              {rankingSignals.insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--md-sys-color-outline)]">Regenerate: node patterns-signals.mjs</p>
          </Md3Card>
        ) : (
          <Md3Card title="System learning">
            <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              {learned >= LEARNING_THRESHOLD ? (
                <>
                  {outcomes} outcomes recorded — enough to learn from. Generate the signals to switch ranking on.
                </>
              ) : (
                <>
                  Ranking starts learning from outcomes at {LEARNING_THRESHOLD}. You have {learned} —{" "}
                  {LEARNING_THRESHOLD - learned} to go.
                </>
              )}
            </p>
            <div className="weights-readout__track">
              <div
                className="weights-readout__bar"
                style={{ width: `${Math.round((learned / LEARNING_THRESHOLD) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-[var(--md-sys-color-outline)]">
              {learned >= LEARNING_THRESHOLD
                ? "Regenerate: node patterns-signals.mjs"
                : "An outcome is a response, interview, offer or rejection — evaluations alone do not count."}
            </p>
          </Md3Card>
        )}

        <DossierSection title="Top companies">
          {topCompanies.map(([name, n]) => (
            <BarRow key={name} label={name} value={n} pct={(n / maxCompany) * 100} />
          ))}
        </DossierSection>
      </DossierStack>
    </PageShell>
  );
}
