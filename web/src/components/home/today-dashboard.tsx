"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Application, InboxJob } from "@/lib/career-ops";
import { canonStatus } from "@/lib/format";
import type { DiscoveredOffer } from "@/lib/explore";
import { MaterialSymbol } from "@/components/material-symbol";
import { DiscoveryCard } from "@/components/explore/discovery-card";
import { FollowUpCard, type FollowUp } from "@/components/home/follow-up-card";
import { DecisionCard } from "@/components/home/decision-card";
import { SinceLastVisit } from "@/components/home/since-last-visit";
import { JobLinkHub } from "@/components/job-link-hub";
import { TitlesBroadening } from "@/components/portals/titles-broadening";
import { DossierHero } from "@/components/dossier/dossier-hero";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { DossierSection } from "@/components/dossier/dossier-section";
import { PageShell } from "@/components/dossier/page-shell";
import { CompanyLogo } from "@/components/company-logo";
import { sortApplications, sortOffers, sortTodayFocus } from "@/lib/list-sort-policy";

export function TodayDashboard({
  applications,
  inbox,
  interviewProgress = {},
}: {
  applications: Application[];
  inbox: InboxJob[];
  inBetween: boolean;
  interviewProgress?: Record<string, { done: number; total: number }>;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [snoozedFollowups, setSnoozedFollowups] = useState<FollowUp[]>([]);
  const [followupsUnavailable, setFollowupsUnavailable] = useState(false);
  const [matchesUnavailable, setMatchesUnavailable] = useState(false);
  const [overdue, setOverdue] = useState(0);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const router = useRouter();
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    [],
  );

  const refetch = useCallback(() => {
    fetch("/api/followups")
      .then((r) => { if (!r.ok) throw new Error("Follow-up schedule unavailable"); return r.json(); })
      .then((d) => {
        setFollowupsUnavailable(d.available === false);
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setSnoozedFollowups(Array.isArray(d.snoozed) ? d.snoozed : []);
        setOverdue(Array.isArray(d.entries) ? d.entries.length : 0);
      })
      .catch(() => setFollowupsUnavailable(true));
    fetch("/api/whats-new")
      .then((r) => { if (!r.ok) throw new Error("Match feed unavailable"); return r.json(); })
      .then((d) => setFresh(sortOffers(Array.isArray(d.offers) ? d.offers : [], "fresh")))
      .catch(() => setMatchesUnavailable(true));
  }, []);

  useEffect(() => {
    refetch();
    const onDone = () => {
      router.refresh();
      refetch();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [refetch, router]);

  const awaiting = useMemo(
    () => sortApplications(applications.filter((a) => /^evaluat/i.test(a.status)), "EVALUATED"),
    [applications],
  );
  const interviewFocus = useMemo(
    () => sortTodayFocus(applications.filter((a) => ["INTERVIEW", "OFFER"].includes(canonStatus(a.status)))),
    [applications],
  );

  const newThisWeek = fresh.length;
  const allClear = overdue === 0 && awaiting.length === 0 && interviewFocus.length === 0;
  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const actionCount = overdue + awaiting.length + interviewFocus.length;
  const primaryFollowups = followups.slice(0, 3);
  const primaryDecisions = awaiting.slice(0, Math.max(0, 3 - primaryFollowups.length));
  const primaryInterviews = interviewFocus.slice(0, Math.max(0, 3 - primaryFollowups.length - primaryDecisions.length));
  const secondaryFollowups = followups.slice(primaryFollowups.length);
  const secondaryDecisions = awaiting.slice(primaryDecisions.length);
  const secondaryInterviews = interviewFocus.slice(primaryInterviews.length);

  return (
    <PageShell width="default">
      <div data-co-tour="today-hero">
      <DossierHero
        eyebrow={`Job search dossier · ${dateLabel}`}
        title={
          allClear ? (
            "You're all caught up"
          ) : (
            <span className="inline-flex items-center gap-3">
              Today&apos;s action queue
              {actionCount > 0 && (
                <span className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-primary-container)] px-2 md-label-medium text-[var(--md-sys-color-on-primary-container)]">
                  {actionCount}
                </span>
              )}
            </span>
          )
        }
        description={
          allClear
            ? "Scanning continues in the background — new matches appear here when they fit your profile."
            : "Discovery, follow-ups, scored roles, and interviews in one place. Work top to bottom."
        }
        actions={
          <>
            <Link href="/explore" className="md3-action-btn md3-action-btn--filled min-h-[56px] px-8">
              <span className="material-symbols-outlined text-[22px] leading-none">explore</span>
              <span className="md3-action-btn__label">Find new roles</span>
            </Link>
            <Link href="/pipeline" className="md3-action-btn md3-action-btn--outlined">
              <span className="material-symbols-outlined text-[20px] leading-none">arrow_forward</span>
              <span className="md3-action-btn__label">Open pipeline</span>
            </Link>
            <Link href="/add" className="md3-action-btn md3-action-btn--outlined">
              <span className="material-symbols-outlined text-[20px] leading-none">link</span>
              <span className="md3-action-btn__label">Add job link</span>
            </Link>
          </>
        }
      />
      </div>

      {(followupsUnavailable || matchesUnavailable) && <p role="status" className="md3-alert md3-alert--warning">
        {followupsUnavailable ? "Follow-up data could not be loaded. " : ""}{matchesUnavailable ? "Fresh matches could not be loaded. " : ""}Refresh this page to retry; the pipeline remains available.
      </p>}

      <SinceLastVisit applications={applications} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4" data-co-tour="today-stats">
        <DossierStat title="New this week" value={newThisWeek} accent={newThisWeek > 0 ? "brand" : "muted"} href="/explore" />
        <DossierStat title="Follow-ups due" value={overdue} accent={overdue > 0 ? "warn" : "muted"} />
        <DossierStat
          title="Awaiting decision"
          value={awaiting.length}
          accent={awaiting.length > 0 ? "brand" : "muted"}
          href={awaiting.length > 0 ? "/pipeline?tab=EVALUATED" : undefined}
        />
        <DossierStat title="Tracked roles" value={applications.length} href="/pipeline" />
      </div>

      {actionCount > 0 && (
        <DossierSection icon={<MaterialSymbol name="priority_high" size={20} />} title="Your next actions" hint="Up to three obligations, ordered by due work then score">
          <div className="flex flex-col gap-2">
            {primaryFollowups.map((f) => <FollowUpCard key={`next-${f.num}-${f.company}`} followup={f} onLogged={() => setOverdue((n) => Math.max(0, n - 1))} onSnoozed={refetch} />)}
            {primaryDecisions.map((a) => <DecisionCard key={`next-${a.n}`} app={a} />)}
            {primaryInterviews.map((a) => (
              <Link key={`next-${a.n}`} href={`/pipeline/${a.n}/interview`} className="flex items-center gap-3 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3 hover:text-[var(--md-sys-color-primary)]">
                <CompanyLogo name={a.company} size={30} />
                <span className="min-w-0 flex-1"><span className="block truncate md-title-small">{a.company}</span><span className="block truncate md-body-small">{a.role}</span></span>
                <span className="md-body-small">{a.offerDeadline ? `Decide by ${a.offerDeadline}` : a.nextInterviewAt ? `Interview ${a.nextInterviewAt}` : "Prepare for interview"}</span>
                <MaterialSymbol name="arrow_forward" size={18} />
              </Link>
            ))}
          </div>
        </DossierSection>
      )}
      {snoozedFollowups.length > 0 && (
        <DossierSection title="Snoozed follow-ups" hint="They return on the date you chose">
          <div className="flex flex-wrap gap-3">
            {snoozedFollowups.map((item) => <Link key={`snoozed-${item.num}`} href={`/pipeline/${item.num}`} className="rounded-lg border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-sm hover:text-[var(--md-sys-color-primary)]">
              {item.company} · returns {item.snoozedUntil} <span className="text-[var(--md-sys-color-outline)]">({item.snoozeReason})</span>
            </Link>)}
          </div>
        </DossierSection>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          {secondaryFollowups.length > 0 && (
            <DossierSection icon={<MaterialSymbol name="notifications" size={20} />} title="More follow-ups due" hint="Urgent first · then due date">
              <div className="flex flex-col gap-2">
                {secondaryFollowups.map((f) => (
                  <FollowUpCard key={`${f.num}-${f.company}`} followup={f} onLogged={() => setOverdue((n) => Math.max(0, n - 1))} onSnoozed={refetch} />
                ))}
              </div>
            </DossierSection>
          )}

          {secondaryDecisions.length > 0 && (
            <DossierSection icon={<MaterialSymbol name="help" size={20} />} title="More roles awaiting your decision" hint="Highest score first">
              <div className="grid gap-3 sm:grid-cols-2">
                {secondaryDecisions.map((a) => (
                  <DecisionCard key={a.n} app={a} />
                ))}
              </div>
            </DossierSection>
          )}

          {secondaryInterviews.length > 0 && (
            <DossierSection
              icon={<MaterialSymbol name="psychology" size={20} />}
              title="Interview focus"
              hint="Next scheduled interview or decision deadline"
            >
              <div className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                {secondaryInterviews.map((a) => {
                  const progress = interviewProgress[a.n];
                  const nextRound = progress ? Math.min(progress.done + 1, progress.total) : 1;
                  return (
                    <Link
                      key={a.n}
                      href={`/pipeline/${a.n}/interview`}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-[var(--md-sys-color-primary)]"
                    >
                      <CompanyLogo name={a.company} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate md-title-small text-[var(--md-sys-color-on-surface)]">{a.company}</span>
                        <span className="block truncate md-body-small text-[var(--md-sys-color-on-surface-variant)]">{a.role}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--md-sys-color-tertiary)]">{canonStatus(a.status)}</span>
                        <span className="block text-xs text-[var(--md-sys-color-outline)]">
                          {a.offerDeadline ? `Decide by ${a.offerDeadline}` : a.nextInterviewAt ? `Interview ${a.nextInterviewAt}` : progress ? `Round ${nextRound}/${progress.total}` : "Start workspace"}
                        </span>
                      </span>
                      <MaterialSymbol name="arrow_forward" size={18} className="shrink-0 text-[var(--md-sys-color-outline)]" />
                    </Link>
                  );
                })}
              </div>
            </DossierSection>
          )}

          {fresh.length > 0 && (
            <DossierSection
              icon={<MaterialSymbol name="rocket_launch" size={20} />}
              title="Fresh matches this week"
              hint="Newest discovered first"
              extra={
                fresh.length > 6 ? (
                  <Link href="/explore" className="text-[var(--md-sys-color-primary)] md-label-large">
                    See all {fresh.length}
                  </Link>
                ) : (
                  <span className="rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-tertiary-container)] px-3 py-1 md-label-medium text-[var(--md-sys-color-on-tertiary-container)]">
                    Free scans · 0 tokens
                  </span>
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {fresh.slice(0, 6).map((o) => (
                  <DiscoveryCard key={o.url} offer={o} inPipeline={inboxUrls.has(o.url)} />
                ))}
              </div>
            </DossierSection>
          )}

          {allClear && (
            <DossierSection title={followupsUnavailable || matchesUnavailable ? "Some updates are unavailable" : "All clear"} hint={followupsUnavailable || matchesUnavailable ? "Refresh to retry" : "Nothing urgent"}>
              <div className="py-8 text-center md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                {followupsUnavailable || matchesUnavailable ? "The dashboard could not refresh every feed. Your pipeline remains available." : <>Run a <Link href="/explore" className="text-[var(--md-sys-color-primary)]">free scan</Link> or review your{" "}<Link href="/pipeline" className="text-[var(--md-sys-color-primary)]">pipeline</Link>.</>}
              </div>
            </DossierSection>
          )}
        </div>

        <div>
          <JobLinkHub compact origin="/" className="mb-4" />
          <TitlesBroadening compact />
        </div>
      </div>
    </PageShell>
  );
}
