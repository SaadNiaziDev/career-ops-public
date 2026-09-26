"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Application, ApplicationStageEvent, DimensionTrend, InboxJob } from "@/lib/career-ops";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierSection } from "@/components/dossier/dossier-section";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { Md3Card } from "@/components/ui/md3-card";
import { MaterialSymbol } from "@/components/material-symbol";
import { canonStatus, scoreNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { countPipelineStages, currentPipelineStage, pipelinePostingSource, pipelineRoleFamily, PIPELINE_STAGES } from "@/lib/pipeline-stages";

/** Outcomes needed before patterns-signals.mjs will bias scan ranking. */
const LEARNING_THRESHOLD = 5;

const STAGES = [
  ...PIPELINE_STAGES,
  { key: "REJECTED", label: "Rejected" },
  { key: "DISCARDED", label: "Discarded" },
];

function BarRow({
  label,
  value,
  pct,
  total,
  fill = "secondary",
  href,
  displayValue,
}: {
  label: string;
  value: number;
  pct: number;
  total?: number;
  fill?: "secondary" | "primary";
  href?: string;
  displayValue?: string;
}) {
  const share = total && total > 0 ? Math.round((value / total) * 100) : null;
  const fillClass =
    fill === "primary"
      ? "bg-[var(--md-sys-color-primary)]"
      : "bg-[var(--md-sys-color-secondary-container)]";

  const row = (
    <div className={cn("flex items-center gap-4 py-2", href && "group rounded-md px-2 hover:bg-[var(--md-sys-color-surface-container)]")}>
      <span className="w-[120px] shrink-0 truncate md-body-medium text-[var(--md-sys-color-on-surface-variant)]">{label}</span>
      <div className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)]">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-[var(--md-sys-shape-corner-medium)]", fillClass)}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums md-body-medium text-[var(--md-sys-color-on-surface)]">
        {displayValue ?? value}
        {!displayValue && share !== null && <span className="ml-1 md-body-small text-[var(--md-sys-color-on-surface-variant)]">{share}%</span>}
      </span>
    </div>
  );
  return href ? <Link href={href} className="block">{row}</Link> : row;
}

function FunnelRow({ label, n, denominator, previous, href }: { label: string; n: number; denominator: number | null; previous?: number; href: string }) {
  const rate = denominator && denominator > 0 ? Math.round((n / denominator) * 100) : null;
  const width = denominator && denominator > 0 ? Math.max(2, Math.min(100, (n / denominator) * 100)) : n > 0 ? 100 : 0;
  return (
    <Link href={href} className="grid grid-cols-[minmax(92px,1fr)_2fr_auto] items-center gap-3 rounded-md px-2 py-2 hover:bg-[var(--md-sys-color-surface-container)]">
      <span className="md-body-medium text-[var(--md-sys-color-on-surface)]">{label}</span>
      <span className="h-7 overflow-hidden rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)]">
        <span className="block h-full rounded-[inherit] bg-[var(--md-sys-color-secondary-container)]" style={{ width: `${width}%` }} />
      </span>
      <span className="min-w-24 text-right tabular-nums md-body-small text-[var(--md-sys-color-on-surface-variant)]">
        {denominator == null ? `${n} roles` : previous === 0 || denominator === 0 ? `${n} · no denominator` : `${n}/${denominator} · ${rate}%`}
      </span>
    </Link>
  );
}

function RateRow({ label, applications, responses, href }: { label: string; applications: number; responses: number; href: string }) {
  const rate = Math.round((responses / applications) * 100);
  return (
    <Link href={href} className="grid grid-cols-[minmax(90px,1fr)_2fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--md-sys-color-surface-container)]">
      <span className="truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">{label}</span>
      <span className="h-5 overflow-hidden rounded bg-[var(--md-sys-color-surface-container)]">
        <span className="block h-full rounded bg-[var(--md-sys-color-secondary-container)]" style={{ width: `${rate}%` }} />
      </span>
      <span className="min-w-24 text-right tabular-nums text-sm text-[var(--md-sys-color-on-surface)]">{responses}/{applications} · {rate}%</span>
    </Link>
  );
}

type RateGroup = { label: string; applications: number; responses: number; href: string };
function makeRateGroups(
  title: string,
  applications: Application[],
  groupFor: (application: Application) => string,
  hrefFor: (label: string) => string,
): { title: string; groups: RateGroup[] } {
  const grouped = new Map<string, { applications: number; responses: number }>();
  for (const application of applications) {
    const label = groupFor(application) || "Unknown";
    const group = grouped.get(label) ?? { applications: 0, responses: 0 };
    group.applications += 1;
    if (["RESPONDED", "INTERVIEW", "OFFER", "REJECTED"].includes(canonStatus(application.status))) group.responses += 1;
    grouped.set(label, group);
  }
  return {
    title,
    groups: [...grouped.entries()]
      .filter(([, group]) => group.applications >= 5)
      .map(([label, group]) => ({ label, ...group, href: hrefFor(label) }))
      .sort((a, b) => b.applications - a.applications || a.label.localeCompare(b.label)),
  };
}

function stageHref(stage: string, period = "all"): string {
  const days = period === "all" ? "" : `&days=${period}`;
  if (stage === "REJECTED" || stage === "DISCARDED") return `/pipeline?tab=${stage}`;
  return `/pipeline?tab=${stage}${days}`;
}

function addPeriod(href: string, period: string): string {
  return period === "all" ? href : `${href}${href.includes("?") ? "&" : "?"}days=${period}`;
}

function scoreBandHref(label: string, period: string): string {
  const band = label.startsWith("4.5") || label.startsWith("4.0") ? "high" : label === "No score" ? "unscored" : "low";
  return addPeriod(`/pipeline?tab=ALL&view=table&scoreBand=${band}`, period);
}

function measuredStageDurations(events: ApplicationStageEvent[], applications: Application[]) {
  const elapsedByStage: Record<string, number[]> = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.key, []]));
  const byNumber = new Map<string, ApplicationStageEvent[]>();
  for (const event of events) byNumber.set(event.n, [...(byNumber.get(event.n) ?? []), event]);
  const now = Date.now();
  const current = new Map(applications.map((application) => [application.n, canonStatus(application.status)]));
  for (const [num, history] of byNumber) {
    history.sort((a, b) => a.at.localeCompare(b.at));
    const entered = new Map<string, number>();
    for (const event of history) {
      const at = Date.parse(event.at);
      if (Number.isNaN(at)) continue;
      const from = currentPipelineStage(canonStatus(event.from));
      const to = currentPipelineStage(canonStatus(event.to));
      if (from && from !== to && entered.has(from)) elapsedByStage[from]!.push(Math.max(0, at - entered.get(from)!));
      if (to && from !== to) entered.set(to, at);
    }
    const active = currentPipelineStage(current.get(num) ?? "");
    if (active && entered.has(active)) elapsedByStage[active]!.push(Math.max(0, now - entered.get(active)!));
  }
  return Object.fromEntries(PIPELINE_STAGES.map((stage) => {
    const days = elapsedByStage[stage.key]!.map((ms) => ms / 86_400_000).sort((a, b) => a - b);
    const middle = Math.floor(days.length / 2);
    const medianDays = days.length === 0 ? null : Math.round((days.length % 2 ? days[middle]! : (days[middle - 1]! + days[middle]!) / 2) * 10) / 10;
    return [stage.key, medianDays == null ? null : { medianDays, sample: days.length }];
  }));
}

export function AnalyticsView({
  applications,
  inbox = [],
  stageHistory = [],
  dimensionTrends = [],
  rankingSignals = null,
}: {
  applications: Application[];
  inbox?: InboxJob[];
  stageHistory?: ApplicationStageEvent[];
  dimensionTrends?: DimensionTrend[];
  rankingSignals?: { sample_size: number; insights: string[] } | null;
}) {
  const [period, setPeriod] = useState<"all" | "30" | "90" | "365">("all");
  const [overdueFollowups, setOverdueFollowups] = useState<{ num: number; company?: string; urgency?: string; nextFollowupDate?: string }[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("career-ops:analytics-period");
      if (saved === "30" || saved === "90" || saved === "365") setPeriod(saved);
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("career-ops:analytics-period", period); } catch { /* storage unavailable */ }
  }, [period]);
  useEffect(() => {
    let active = true;
    fetch("/api/followups")
      .then((response) => response.ok ? response.json() : null)
      .then((data: { entries?: { num: number; company?: string; urgency?: string; nextFollowupDate?: string }[] } | null) => {
        if (active) setOverdueFollowups((data?.entries ?? []).filter((entry) => /overdue|urgent/i.test(entry.urgency ?? "")));
      })
      .catch(() => { if (active) setOverdueFollowups([]); });
    return () => { active = false; };
  }, []);

  const cutoff = period === "all" ? null : new Date(Date.now() - Number(period) * 86_400_000).toISOString().slice(0, 10);
  const trackedApplications = useMemo(
    () => applications.filter((application) => !cutoff || /^\d{4}-\d{2}-\d{2}$/.test(application.date) && application.date >= cutoff),
    [applications, cutoff],
  );
  const discoveredInbox = useMemo(
    () => inbox.filter((role) => !cutoff || !!role.postedAt && role.postedAt >= cutoff),
    [inbox, cutoff],
  );
  const total = trackedApplications.length;

  const currentCounts = countPipelineStages(trackedApplications, (row) => canonStatus(row.status));
  const stageCounts = STAGES.map((s) => ({
    ...s,
    n: s.key in currentCounts
      ? currentCounts[s.key as keyof typeof currentCounts]
      : trackedApplications.filter((a) => canonStatus(a.status) === s.key).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  const scores = trackedApplications.map((a) => scoreNum(a.score)).filter((n) => !Number.isNaN(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buckets = [
    { label: "4.5 – 5.0", test: (n: number) => n >= 4.5 },
    { label: "4.0 – 4.4", test: (n: number) => n >= 4 && n < 4.5 },
    { label: "3.0 – 3.9", test: (n: number) => n >= 3 && n < 4 },
    { label: "< 3.0", test: (n: number) => n < 3 },
  ].map((b) => ({ label: b.label, n: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const companyCounts = new Map<string, number>();
  for (const a of trackedApplications) if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  const maxCompany = Math.max(1, ...topCompanies.map((c) => c[1]));

  const offers = stageCounts.find((s) => s.key === "OFFER")?.n ?? 0;
  const interviews = stageCounts.find((s) => s.key === "INTERVIEW")?.n ?? 0;

  // Outcomes the ranker can learn from — a reply of any kind, not an evaluation.
  const OUTCOME_STAGES = ["RESPONDED", "INTERVIEW", "OFFER", "REJECTED"];
  const outcomes = trackedApplications.filter((a) => OUTCOME_STAGES.some((s) => canonStatus(a.status) === s)).length;
  const learned = Math.min(LEARNING_THRESHOLD, rankingSignals?.sample_size ?? outcomes);
  const appStates = trackedApplications.map((application) => ({ application, state: canonStatus(application.status) }));
  const evaluatedN = appStates.filter(({ state }) => state !== "SKIP").length;
  const appliedStates = new Set(["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "REJECTED"]);
  const appliedRows = appStates.filter(({ state }) => appliedStates.has(state)).map(({ application }) => application);
  const respondedN = appStates.filter(({ state }) => ["RESPONDED", "INTERVIEW", "OFFER", "REJECTED"].includes(state)).length;
  const interviewN = appStates.filter(({ state }) => ["INTERVIEW", "OFFER"].includes(state)).length;
  const offerN = currentCounts.OFFER;
  const discoveredN = evaluatedN + discoveredInbox.length;
  const funnel = [
    { key: "INBOX", label: "Discovered", n: discoveredN, denominator: null, href: "/pipeline?tab=INBOX" },
    { key: "EVALUATED", label: "Tracked (excluding SKIP)", n: evaluatedN, denominator: discoveredN, href: "/pipeline?tab=ALL&view=table" },
    { key: "APPLIED", label: "Applied", n: appliedRows.length, denominator: evaluatedN, href: "/pipeline?tab=APPLIED" },
    { key: "RESPONDED", label: "Responded", n: respondedN, denominator: appliedRows.length, href: "/pipeline?tab=RESPONDED" },
    { key: "INTERVIEW", label: "Interview", n: interviewN, denominator: respondedN, href: "/pipeline?tab=INTERVIEW" },
    { key: "OFFER", label: "Offer", n: offerN, denominator: interviewN, href: "/pipeline?tab=OFFER" },
  ];
  const responseBreakdowns = [
    makeRateGroups("Score band", appliedRows, (row) => {
      const score = scoreNum(row.score);
      return Number.isNaN(score) ? "No score" : score >= 4 ? "4.0+" : "Below 4.0";
    }, (label) => addPeriod(`/pipeline?tab=APPLIED&scoreBand=${label === "4.0+" ? "high" : label === "Below 4.0" ? "low" : "unscored"}`, period)),
    makeRateGroups("Role family", appliedRows, (row) => pipelineRoleFamily(row.role), (label) => addPeriod(`/pipeline?tab=APPLIED&roleFamily=${encodeURIComponent(label)}`, period)),
    makeRateGroups("Posting source", appliedRows, (row) => pipelinePostingSource(row.url, row.via) || "Unknown", (label) => addPeriod(`/pipeline?tab=APPLIED&source=${encodeURIComponent(label)}`, period)),
    makeRateGroups("Location", appliedRows, (row) => row.location?.trim() || "Unknown", (label) => addPeriod(`/pipeline?tab=APPLIED&location=${encodeURIComponent(label)}`, period)),
  ];
  const scoreBandGroups = responseBreakdowns[0]!.groups;
  const highFit = scoreBandGroups.find((group) => group.label === "4.0+");
  const lowFit = scoreBandGroups.find((group) => group.label === "Below 4.0");
  const scoreRecommendation = highFit && lowFit
    ? highFit.responses / highFit.applications >= lowFit.responses / lowFit.applications
      ? { message: `Review 4.0+ matches first: ${Math.round(highFit.responses / highFit.applications * 100)}% replied versus ${Math.round(lowFit.responses / lowFit.applications * 100)}% below 4.0.`, href: highFit.href }
      : { message: `Review below-4.0 matches before adjusting your target score: ${Math.round(lowFit.responses / lowFit.applications * 100)}% replied versus ${Math.round(highFit.responses / highFit.applications * 100)}% at 4.0+.`, href: lowFit.href }
    : null;
  const stageDurations = measuredStageDurations(stageHistory, trackedApplications);

  return (
    <PageShell width="default" className="max-w-[900px]">
      <DossierStack>
        {/* S10 · gap 1: Export CSV used to exist only in the command palette.
            It belongs in the header, where the data it exports is. */}
        <div data-co-tour="analytics-hero">
        <DossierPageHeader
          title="Analytics"
          description={`Current snapshot: ${total} tracked roles and ${discoveredInbox.length} inbox roles${period === "all" ? "" : ` from the last ${period} days`}.`}
          extra={
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-10 items-center gap-2 rounded-full border border-[var(--md-sys-color-outline-variant)] px-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                Tracked within
                <select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="bg-transparent text-[var(--md-sys-color-on-surface)] outline-none">
                  <option value="all">All time</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">365 days</option>
                </select>
              </label>
              <a href="/api/export?kind=tracker" className="md3-btn-outlined min-h-10" download>
                <MaterialSymbol name="download" size={18} />
                Export CSV
              </a>
            </div>
          }
        />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-co-tour="analytics-stats">
          <DossierStat title="tracked roles" value={total} href={addPeriod("/pipeline?tab=ALL&view=table", period)} />
          <Md3Card>
            <p className="dossier-stat-title mb-1">avg score</p>
            <Link href={addPeriod("/pipeline?tab=ALL&view=table", period)} className="text-[28px] tabular-nums text-[var(--md-sys-color-on-surface)]">{avg ? avg.toFixed(2) : "—"}</Link>
          </Md3Card>
          <DossierStat
            title="interviews"
            value={interviews}
            href={addPeriod("/pipeline?tab=INTERVIEW", period)}
            accent={interviews === 0 ? "muted" : "default"}
          />
          <DossierStat title="offers" value={offers} href={addPeriod("/pipeline?tab=OFFER", period)} accent={offers > 0 ? "brand" : "muted"} />
        </div>

        {interviews === 0 && (
          <Link href="/" className="block md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            Interviews follow replies — keep follow-ups warm
          </Link>
        )}

        <DossierSection title="Search funnel">
          <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Current tracker states form a snapshot, not a historical cohort. Rejected roles count as replies and as previously applied. No causal effect is implied.
          </p>
          <div className="space-y-1">
            {funnel.map((step, index) => (
              <FunnelRow key={step.key} label={step.label} n={step.n} denominator={step.denominator} href={addPeriod(step.href, period)} previous={index > 0 ? funnel[index - 1].n : undefined} />
            ))}
          </div>
        </DossierSection>

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
              href={addPeriod(stageHref(s.key), period)}
            />
          ))}
        </DossierSection>
        </div>

        <DossierSection title="Score distribution">
          {buckets.map((b) => (
            <BarRow key={b.label} label={b.label} value={b.n} pct={(b.n / maxBucket) * 100} total={scores.length} href={scoreBandHref(b.label, period)} />
          ))}
        </DossierSection>

        <DossierSection title="Reply rates by group">
          <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">Only groups with at least five applications are shown. Response means a response, interview, offer, or rejection recorded in the current status. Select a row to inspect its applications.</p>
          {responseBreakdowns.map((breakdown) => (
            <section key={breakdown.title} className="mb-5 last:mb-0">
              <h3 className="mb-2 md-title-small text-[var(--md-sys-color-on-surface)]">{breakdown.title}</h3>
              {breakdown.groups.length ? breakdown.groups.map((group) => (
                <RateRow key={group.label} {...group} />
              )) : <p className="mb-0 text-sm text-[var(--md-sys-color-outline)]">Not enough applications in any group yet.</p>}
            </section>
          ))}
        </DossierSection>

        <DossierSection title="Search adjustment">
          {scoreRecommendation ? (
            <Link href={scoreRecommendation.href} className="block rounded-md p-3 text-sm text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container)]">
              {scoreRecommendation.message} This is a descriptive comparison, not evidence that score caused the reply difference.
            </Link>
          ) : <p className="mb-0 text-sm text-[var(--md-sys-color-on-surface-variant)]">Need at least five applications in both score bands before suggesting a score adjustment.</p>}
        </DossierSection>

        <DossierSection title="Overdue follow-ups">
          {overdueFollowups.length ? overdueFollowups.map((entry) => (
            <Link key={entry.num} href={`/pipeline/${entry.num}`} className="flex justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-[var(--md-sys-color-surface-container)]">
              <span className="text-[var(--md-sys-color-on-surface)]">{entry.company || `Application ${entry.num}`}</span>
              <span className="text-[var(--md-sys-color-error)]">{entry.urgency || "Overdue"} · {entry.nextFollowupDate || "due"}</span>
            </Link>
          )) : <p className="mb-0 text-sm text-[var(--md-sys-color-on-surface-variant)]">No overdue follow-ups returned by the cadence tracker.</p>}
        </DossierSection>

        <DossierSection title="Median time in stage">
          <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">Measured from local status changes recorded since this feature was added. Earlier transitions are not available.</p>
          {PIPELINE_STAGES.map((stage) => {
            const metric = stageDurations[stage.key];
            return (
              <BarRow
                key={stage.key}
                label={stage.label}
                value={metric?.medianDays ?? 0}
                pct={metric ? Math.min(100, metric.medianDays * 5) : 0}
                total={metric?.sample}
                displayValue={metric ? `${metric.medianDays}d · n=${metric.sample}` : "Building history"}
                href={addPeriod(stageHref(stage.key), period)}
              />
            );
          })}
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
            <BarRow key={name} label={name} value={n} pct={(n / maxCompany) * 100} href={addPeriod(`/pipeline?tab=ALL&view=table&q=${encodeURIComponent(name)}`, period)} />
          ))}
        </DossierSection>
      </DossierStack>
    </PageShell>
  );
}
