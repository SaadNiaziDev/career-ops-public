"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DossierHero } from "@/components/dossier/dossier-hero";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { DossierSection } from "@/components/dossier/dossier-section";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { PageShell } from "@/components/dossier/page-shell";
import { OutreachStrip } from "@/components/outreach/outreach-strip";
import { CompanyLogo } from "@/components/company-logo";
import {
  sortApplications,
  sortOffers,
  sortTodayFocus,
} from "@/lib/list-sort-policy";

export function TodayDashboard({
  applications,
  inbox,
  interviewProgress = {},
  outreach = { ready: 0, due: 0 },
}: {
  applications: Application[];
  inbox: InboxJob[];
  outreach?: { ready: number; due: number };
  interviewProgress?: Record<string, { done: number; total: number }>;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [snoozedFollowups, setSnoozedFollowups] = useState<FollowUp[]>([]);
  const [followupsUnavailable, setFollowupsUnavailable] = useState(false);
  const [matchesUnavailable, setMatchesUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const [showAllActions, setShowAllActions] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const refetch = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const { signal } = controller;
    setLoading(true);
    const followupRequest = fetch("/api/followups", { signal })
      .then((r) => {
        if (!r.ok) throw new Error("Follow-up schedule unavailable");
        return r.json();
      })
      .then((d) => {
        if (signal.aborted) return;
        setFollowupsUnavailable(d.available === false);
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setSnoozedFollowups(Array.isArray(d.snoozed) ? d.snoozed : []);
      })
      .catch(() => { if (!signal.aborted) setFollowupsUnavailable(true); });
    const matchRequest = fetch("/api/whats-new", { signal })
      .then((r) => {
        if (!r.ok) throw new Error("Match feed unavailable");
        return r.json();
      })
      .then((d) => {
        if (signal.aborted) return;
        setMatchesUnavailable(false);
        setFresh(sortOffers(Array.isArray(d.offers) ? d.offers : [], "fresh"));
      })
      .catch(() => { if (!signal.aborted) setMatchesUnavailable(true); });
    return Promise.allSettled([followupRequest, matchRequest]).then(() => {
      if (!signal.aborted) setLoading(false);
    });
  }, []);

  useEffect(() => {
    refetch();
    const onDone = () => {
      router.refresh();
      refetch();
    };
    window.addEventListener("co-job-done", onDone);
    return () => {
      requestRef.current?.abort();
      window.removeEventListener("co-job-done", onDone);
    };
  }, [refetch, router]);

  const awaiting = useMemo(
    () =>
      sortApplications(
        applications.filter((a) => /^evaluat/i.test(a.status)),
        "EVALUATED",
      ),
    [applications],
  );
  const interviewFocus = useMemo(
    () =>
      sortTodayFocus(
        applications.filter((a) =>
          ["INTERVIEW", "OFFER"].includes(canonStatus(a.status)),
        ),
      ),
    [applications],
  );

  const overdue = followups.length;
  const unavailable = followupsUnavailable || matchesUnavailable;
  const allClear =
    !loading && !unavailable && overdue === 0 && awaiting.length === 0 && interviewFocus.length === 0 && outreach.ready === 0 && outreach.due === 0;
  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const actionCount = overdue + awaiting.length + interviewFocus.length;
  const actions = [
    ...followups.map((followup, index) => ({
      key: `followup-${followup.num ?? index}-${followup.company}`,
      content: <FollowUpCard followup={followup} onLogged={() => void refetch()} onSnoozed={refetch} />,
    })),
    ...interviewFocus.map((app) => ({
      key: `interview-${app.n}`,
      content: <InterviewAction app={app} progress={interviewProgress[app.n]} />,
    })),
    ...awaiting.map((app) => ({ key: `decision-${app.n}`, content: <DecisionCard app={app} /> })),
  ];
  const visibleActions = showAllActions ? actions : actions.slice(0, 3);

  return (
    <PageShell width="wide" className="today-dashboard">
      <DossierStack>
        <div data-co-tour="today-hero">
          <DossierHero
            className="today-dashboard-hero"
            eyebrow={`Job search dossier · ${dateLabel}`}
            title="Today"
            description={
              loading ? "Loading your follow-ups and fresh matches…"
                : unavailable ? "Some updates are unavailable. You can still review your pipeline."
                : allClear ? "You're all caught up. Explore new roles when you're ready."
                : "Follow up, prepare for interviews, and review your next role."
            }
            actions={
              <>
                <Link
                  href="/explore"
                  className="md3-action-btn md3-action-btn--filled min-h-10 px-4"
                >
                  <span className="material-symbols-outlined text-[22px] leading-none">
                    explore
                  </span>
                  <span className="md3-action-btn__label">Find new roles</span>
                </Link>
                <Link
                  href="/add"
                  className="md3-action-btn md3-action-btn--outlined min-h-10 px-4"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">
                    link
                  </span>
                  <span className="md3-action-btn__label">Add job link</span>
                </Link>
              </>
            }
          />
        </div>

        {(followupsUnavailable || matchesUnavailable) && (
          <p role="status" className="md3-alert md3-alert--warning">
            {followupsUnavailable ? "Follow-up data could not be loaded. " : ""}
            {matchesUnavailable ? "Fresh matches could not be loaded. " : ""}
            Refresh this page to retry; the pipeline remains available.
          </p>
        )}

        <SinceLastVisit applications={applications} />

        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
          data-co-tour="today-stats"
        >
          <DossierStat
            title="Fresh matches"
            value={loading || matchesUnavailable ? "—" : fresh.length}
            accent={fresh.length > 0 ? "brand" : "muted"}
            href="/explore?view=matches"
          />
          <DossierStat
            title="Follow-ups due"
            value={loading || followupsUnavailable ? "—" : overdue}
            href={overdue > 0 ? "#today-actions" : undefined}
            accent={overdue > 0 ? "warn" : "muted"}
          />
          <DossierStat
            title="Awaiting decision"
            value={awaiting.length}
            accent={awaiting.length > 0 ? "brand" : "muted"}
            href={awaiting.length > 0 ? "/pipeline?tab=EVALUATED" : undefined}
          />
          <DossierStat
            title="Tracked roles"
            value={applications.length}
            href="/pipeline"
          />
        </div>

        <OutreachStrip ready={outreach.ready} due={outreach.due} />

        {actionCount > 0 && (
          <section id="today-actions" aria-label="Your next actions" className="scroll-mt-24">
            <DossierSection
              icon={<MaterialSymbol name="priority_high" size={20} />}
              title="Your next actions"
              hint={`${actionCount} to review`}
            >
              <div id="today-action-list" className="flex flex-col gap-2">
                {visibleActions.map((action) => <div key={action.key}>{action.content}</div>)}
              </div>
              {actions.length > 3 && (
                <button type="button" className="md3-action-btn md3-action-btn--text mt-2" aria-controls="today-action-list" aria-expanded={showAllActions} onClick={() => setShowAllActions((value) => !value)}>
                  {showAllActions ? "Show fewer actions" : `Show all ${actions.length} actions`}
                </button>
              )}
            </DossierSection>
          </section>
        )}
        {snoozedFollowups.length > 0 && (
          <details className="rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Snoozed follow-ups · {snoozedFollowups.length}
            </summary>
            <div className="flex flex-wrap gap-2 border-t border-[var(--md-sys-color-outline-variant)] p-3">
              {snoozedFollowups.map((item) => (
                <Link
                  key={`snoozed-${item.num}`}
                  href={`/pipeline/${item.num}`}
                  className="rounded-lg border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-sm hover:text-[var(--md-sys-color-primary)]"
                >
                  {item.company} · returns {item.snoozedUntil}{" "}
                  <span className="text-[var(--md-sys-color-outline)]">
                    ({item.snoozeReason})
                  </span>
                </Link>
              ))}
            </div>
          </details>
        )}

        {fresh.length > 0 && (
          <DossierSection
            icon={<MaterialSymbol name="rocket_launch" size={20} />}
            title="Fresh matches this week"
            hint="Newest discovered first"
            extra={<Link href="/explore?view=matches" className="text-[var(--md-sys-color-primary)] md-label-large">View matches</Link>}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {fresh.slice(0, 3).map((o) => (
                <DiscoveryCard
                  key={o.url}
                  offer={o}
                  inPipeline={inboxUrls.has(o.url)}
                />
              ))}
            </div>
          </DossierSection>
        )}

      </DossierStack>
    </PageShell>
  );
}

function InterviewAction({ app, progress }: { app: Application; progress?: { done: number; total: number } }) {
  const offer = canonStatus(app.status) === "OFFER";
  return (
    <Link href={`/pipeline/${app.n}/interview`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3 hover:text-[var(--md-sys-color-primary)]">
      <CompanyLogo name={app.company} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate md-title-small">{app.company}</span>
        <span className="block truncate md-body-small">{app.role}</span>
      </span>
      <span className="md-body-small">
        {offer ? (app.offerDeadline ? `Decide by ${app.offerDeadline}` : "Review offer")
          : app.nextInterviewAt ? `Interview ${app.nextInterviewAt}` : "Prepare for interview"}
        {progress && <span className="block text-[var(--md-sys-color-on-surface-variant)]">{progress.done}/{progress.total} prep complete</span>}
      </span>
      <MaterialSymbol name="arrow_forward" size={18} />
    </Link>
  );
}
