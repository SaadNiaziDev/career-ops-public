"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Application, InboxJob } from "@/lib/career-ops";
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

export function TodayDashboard({
  applications,
  inbox,
}: {
  applications: Application[];
  inbox: InboxJob[];
  inBetween: boolean;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const router = useRouter();
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    [],
  );

  const refetch = useCallback(() => {
    fetch("/api/followups")
      .then((r) => r.json())
      .then((d) => {
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setOverdue(d.metadata?.overdue ?? d.entries?.length ?? 0);
      })
      .catch(() => {});
    fetch("/api/whats-new")
      .then((r) => r.json())
      .then((d) => setFresh(Array.isArray(d.offers) ? d.offers : []))
      .catch(() => {});
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
    () => applications.filter((a) => /^evaluat/i.test(a.status)).slice(0, 6),
    [applications],
  );

  const newThisWeek = fresh.length;
  const allClear = newThisWeek === 0 && overdue === 0 && awaiting.length === 0;
  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const actionCount = overdue + awaiting.length + Math.min(newThisWeek, 6);

  return (
    <PageShell width="default">
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
            : "Discovery, follow-ups, and scored roles in one place. Work top to bottom."
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

      <SinceLastVisit applications={applications} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          {followups.length > 0 && (
            <DossierSection icon={<MaterialSymbol name="notifications" size={20} />} title="Follow-ups due" hint="Keep applications alive">
              <div className="flex flex-col gap-2">
                {followups.map((f) => (
                  <FollowUpCard key={`${f.num}-${f.company}`} followup={f} onLogged={() => setOverdue((n) => Math.max(0, n - 1))} />
                ))}
              </div>
            </DossierSection>
          )}

          {awaiting.length > 0 && (
            <DossierSection icon={<MaterialSymbol name="help" size={20} />} title="Awaiting your decision" hint="Scored — apply or skip">
              <div className="grid gap-3 sm:grid-cols-2">
                {awaiting.map((a) => (
                  <DecisionCard key={a.n} app={a} />
                ))}
              </div>
            </DossierSection>
          )}

          {fresh.length > 0 && (
            <DossierSection
              icon={<MaterialSymbol name="rocket_launch" size={20} />}
              title="Fresh matches this week"
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
            <DossierSection title="All clear" hint="Nothing urgent">
              <div className="py-8 text-center md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
                Run a <Link href="/explore" className="text-[var(--md-sys-color-primary)]">free scan</Link> or review your{" "}
                <Link href="/pipeline" className="text-[var(--md-sys-color-primary)]">pipeline</Link>.
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
