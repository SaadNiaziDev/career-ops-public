"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Application, InboxJob, ScanFind } from "@/lib/career-ops";
import { paramsToFilters, paramsToAi, type ExploreFilters } from "@/lib/explore";
import { useCliConfig, resolveCliIdForRun } from "@/lib/cli-config";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { MaterialSymbol } from "@/components/material-symbol";
import { Badge } from "@/components/ui/badge";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Empty } from "@/components/ui/md3-empty";
import { cn } from "@/lib/cn";
import { FilterBuilder } from "./filter-builder";
import { DiscoveringState } from "./discovering-state";
import { AiHuntView } from "./ai-hunt-view";
import { ExploreModeToggle } from "./explore-mode-toggle";
import { AiSearchBox } from "./ai-search-box";
import { ResultsList, type EnrichedOffer } from "./results-list";
import { DiscoveryCard } from "./discovery-card";
import { CostBadge } from "@/components/cost/cost-badge";
import { useExplore } from "./explore-provider";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function ControlledMd3Collapse({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("md3-collapse", className)}>
      <button
        type="button"
        className="md3-collapse__header"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 text-left">{title}</span>
        <MaterialSymbol name="expand_more" size={22} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="md3-collapse__body">{children}</div> : null}
    </section>
  );
}

export function ExplorerView({
  seed,
  inboxSnapshot,
  appsSnapshot,
  rootExists,
  scans,
}: {
  seed: { filters: ExploreFilters; seededFrom: string[] };
  inboxSnapshot: InboxJob[];
  appsSnapshot: Application[];
  rootExists: boolean;
  scans: { finds: ScanFind[]; latestDate: string | null; totalPending: number };
}) {
  const { filters, setFilters, initFilters, phase, running, offers, discover, status, error, mode, setMode, resultsMode, aiIntent, setAiIntent, discoverAI, companiesScanned, companiesAvailable, capHit, droppedNoDate, partial } = useExplore();
  const scanNote =
    companiesScanned > 0
      ? `Scanned ${companiesScanned.toLocaleString()}${companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} compan${companiesScanned === 1 ? "y" : "ies"}${partial ? " · some sources were unreachable" : ""}.`
      : undefined;
  const inited = useRef(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const { cliName, cliConfigured } = useCliConfig();
  const [firstRun, setFirstRun] = useState(false);

  // AI URL hydration + auto-hunt lives in ExploreProvider (URL beats sessionStorage).
  // Here we only seed Scan filters / optional ?run=1 — never touch AI intent, or we'd
  // race the provider and abort a hunt that just started.
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const sp = new URLSearchParams(window.location.search);
    if (paramsToAi(sp) !== null) return;
    initFilters(sp.toString() ? paramsToFilters(sp) : seed.filters);
    if (sp.get("run") === "1") {
      setFirstRun(true);
      void discover();
    }
  }, [seed.filters, initFilters, discover]);

  const inboxUrls = useMemo(() => new Set(inboxSnapshot.map((j) => j.url)), [inboxSnapshot]);
  const enriched: EnrichedOffer[] = useMemo(
    () =>
      offers.map((o) => {
        const inPipeline = inboxUrls.has(o.url);
        const c = norm(o.company);
        const t = norm(o.title);
        const ev = appsSnapshot.find((a) => {
          if (norm(a.company) !== c) return false;
          const ar = norm(a.role);
          return ar.length > 3 && (t.includes(ar) || ar.includes(t.split(" ").slice(0, 3).join(" ")));
        });
        return { ...o, inPipeline, evaluatedN: ev?.n };
      }),
    [offers, inboxUrls, appsSnapshot],
  );

  const isAi = mode === "ai";
  if (running) return isAi ? <AiHuntView cliName={cliName} /> : <DiscoveringState />;

  const canDiscover = filters.ats.length > 0;
  // Each tab owns its own results: a settled run belongs to the surface that ran
  // it, so switching tabs never shows the other one's hits.
  const ownsResults = resultsMode === mode;
  const isResults = phase === "results" && ownsResults;
  const showPhase = (p: typeof phase) => phase === p && ownsResults;

  // Scan tab with no live run of its own falls back to what the portal scanners
  // (scan.mjs / workers) wrote to pipeline.md — same cards, same actions.
  const scanFindOffers: EnrichedOffer[] = scans.finds.map((f) => ({
    url: f.url,
    company: f.company,
    title: f.role,
    location: f.location ?? "",
    postedAt: f.firstSeen,
    ats: f.source,
    source: f.source,
    fitScore: f.fitScore,
    inPipeline: true,
    evaluatedN: appsSnapshot.find((a) => norm(a.company) === norm(f.company) && norm(a.role) === norm(f.role))?.n,
  }));
  const showScanFinds = !isAi && !isResults && scanFindOffers.length > 0;

  return (
    <PageShell width="default">
      <DossierStack>
        <header>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <MaterialSymbol name="explore" size={24} className="text-[var(--md-sys-color-primary)]" />
              <h2 className="mb-0 md-headline-medium">Explore</h2>
              <Badge tone="warn">New</Badge>
            </div>
            <div className="w-full sm:ml-auto sm:w-auto">
              <ExploreModeToggle mode={mode} onChange={setMode} cliConfigured={cliConfigured} />
            </div>
          </div>
          {!isResults && (
            <p className="mt-3 max-w-2xl md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
              {isAi
                ? "Describe the role in plain language — an AI hunts the open web for it, on your own AI. Candidates are unverified until you evaluate."
                : "Scan the public ATS network — Greenhouse, Lever, Ashby, Workday. Fresh postings matched to you, zero tokens. You only spend when you choose to evaluate one."}
            </p>
          )}
        </header>

        {!rootExists && (
          <p className="md3-alert md3-alert--warning mb-5">
            <MaterialSymbol name="warning" size={20} className="shrink-0" />
            <span>Your career-ops home isn&apos;t set up yet — discovery needs a checkout with a profile to seed from.</span>
          </p>
        )}

        {isAi ? (
          phase === "blocked" && !cliConfigured ? (
            <BlockedCard
              onRetry={() => {
                void resolveCliIdForRun().then((id) => {
                  if (id) void discoverAI();
                });
              }}
            />
          ) : (
            <div className="space-y-6">
              <AiSearchBox
                intent={aiIntent}
                onIntent={setAiIntent}
                onSubmit={() => void discoverAI(aiIntent)}
                cliConfigured={cliConfigured}
                cliName={cliName}
                onRunScan={() => setMode("scan")}
              />
              {isResults && <ResultsList offers={enriched} />}
              {showPhase("empty-loose") && (
                <EmptyState
                  tone="loose"
                  title="No public matches — yet."
                  body="AI search reads what's public. Try broader intent, or run the free Scan over the ATS network."
                  onRerun={() => setMode("scan")}
                  rerunLabel="Run the free Scan"
                />
              )}
              {showPhase("failed") && <FailedCard msg={error || status} onRetry={() => void discoverAI()} />}
            </div>
          )
        ) : (
          <>
            {isResults ? (
              <ControlledMd3Collapse
                className="mb-6"
                open={refineOpen}
                onOpenChange={setRefineOpen}
                title={
                  <span className="inline-flex items-center gap-2">
                    <MaterialSymbol name="explore" size={18} />
                    Refine search
                  </span>
                }
              >
                <div className="flex w-full flex-col gap-4">
                  <FilterBuilder filters={filters} onChange={setFilters} seededFrom={seed.seededFrom} />
                  <DiscoverBar canDiscover={canDiscover} onDiscover={discover} label="Re-cast (free)" />
                </div>
              </ControlledMd3Collapse>
            ) : (
              <Md3Card className="mb-6">
                <FilterBuilder filters={filters} onChange={setFilters} seededFrom={seed.seededFrom} />
                <div className="mt-5">
                  <DiscoverBar canDiscover={canDiscover} onDiscover={discover} label="Discover (free)" />
                </div>
              </Md3Card>
            )}

            {isResults && firstRun && (
              <p className="md3-alert md3-alert--success mb-4">
                <MaterialSymbol name="bolt" size={20} className="shrink-0" />
                <span>
                  These are live roles that match your CV.{" "}
                  <span className="text-[var(--md-sys-color-on-tertiary-container)]">
                    Nothing here cost you a token.
                  </span>{" "}
                  Pick the one you&apos;re most curious about — Evaluate it and I&apos;ll tell you exactly how you score,
                  and why.
                </span>
              </p>
            )}

            {isResults && capHit && (
              <CappedBanner
                companiesScanned={companiesScanned}
                companiesAvailable={companiesAvailable}
                onRefine={() => setRefineOpen(true)}
              />
            )}
            {isResults && <ResultsList offers={enriched} />}

            {showScanFinds && (
              <ScanFindsSection offers={scanFindOffers} latestDate={scans.latestDate} totalPending={scans.totalPending} />
            )}

            {showPhase("empty-current") && (
              <EmptyState
                tone="good"
                title="You're all caught up."
                body="Nothing new since your last scan. Your pipeline is current — that's the goal."
                note={scanNote}
                onRerun={() => {
                  setFilters({ ...filters, sinceDays: Math.max(filters.sinceDays, 30) });
                  void discover();
                }}
                rerunLabel="Look back 30 days"
              />
            )}
            {showPhase("empty-loose") && (
              <EmptyState
                tone="loose"
                title="No fresh matches — yet."
                body="Discovery is free — loosen and re-cast as often as you want."
                note={scanNote}
                onRerun={() => {
                  setFilters({ ...filters, sinceDays: 30, block: [], allow: [] });
                  void discover();
                }}
                rerunLabel="Widen to 30 days · clear location"
              />
            )}
            {showPhase("degraded") && (
              <DegradedCard
                onRetry={() => void discover()}
                companiesScanned={companiesScanned}
                companiesAvailable={companiesAvailable}
                capHit={capHit}
                droppedNoDate={droppedNoDate}
                partial={partial}
              />
            )}
            {showPhase("failed") && <FailedCard msg={error || status} onRetry={() => void discover()} />}
          </>
        )}
      </DossierStack>
    </PageShell>
  );
}

/** What the portal scanners already found, as the Scan tab's standing result set.
 *  These live in pipeline.md (written by scan.mjs / workers), so unlike an in-browser
 *  run they survive reloads — they are the Scan tab's answer when it has no live run. */
function ScanFindsSection({
  offers,
  latestDate,
  totalPending,
}: {
  offers: EnrichedOffer[];
  latestDate: string | null;
  totalPending: number;
}) {
  const newest = latestDate ? offers.filter((o) => o.postedAt === latestDate).length : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="mb-0 md-body-large text-[var(--md-sys-color-on-surface)]">
            <span className="font-medium">{offers.length}</span> from your portal scans
            <CostBadge kind="free-network" size="xs" className="ml-2 align-middle" />
          </p>
          <p className="md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            {newest > 0 ? `${newest} added in the latest scan · ` : ""}
            last 14 days · already in your inbox
          </p>
        </div>
        <Link href="/pipeline" className="ml-auto">
          <Md3ActionButton variant="outlined" icon="arrow_forward">
            Triage all {totalPending}
          </Md3ActionButton>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {offers.map((o) => (
          <DiscoveryCard key={o.url} offer={o} inPipeline={o.inPipeline} evaluatedN={o.evaluatedN} />
        ))}
      </div>
    </section>
  );
}

function DiscoverBar({ canDiscover, onDiscover, label }: { canDiscover: boolean; onDiscover: () => void; label: string }) {
  return (
    <div className="md3-actions-row">
      <Md3ActionButton variant="filled" icon="explore" disabled={!canDiscover} onClick={onDiscover}>
        {label}
      </Md3ActionButton>
      <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
        Evaluating a role later costs tokens. Discovering never does.
      </span>
    </div>
  );
}

function EmptyState({
  tone,
  title,
  body,
  note,
  onRerun,
  rerunLabel,
}: {
  tone: "good" | "loose";
  title: string;
  body: string;
  note?: string;
  onRerun: () => void;
  rerunLabel: string;
}) {
  return (
    <Md3Card>
      <Md3Empty icon={tone === "good" ? "task_alt" : "bolt"}>
        <h4 className="mt-3 mb-1 md-title-medium">{title}</h4>
        <p className="mb-0 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">{body}</p>
        {note && <p className="mt-2 mb-0 text-xs text-[var(--md-sys-color-on-surface-variant)]">{note}</p>}
        <Md3ActionButton className="mt-4" icon="refresh" onClick={onRerun}>
          {rerunLabel}
        </Md3ActionButton>
      </Md3Empty>
    </Md3Card>
  );
}

function DegradedCard({
  onRetry,
  companiesScanned,
  companiesAvailable,
  capHit,
  droppedNoDate,
  partial,
}: {
  onRetry: () => void;
  companiesScanned: number;
  companiesAvailable: number;
  capHit: boolean;
  droppedNoDate: number;
  partial: boolean;
}) {
  let title = "The scan ran, but couldn’t reach any sources.";
  let body =
    "The public ATS directories didn’t respond — usually a transient network hiccup or rate-limit, so nothing could be searched. This isn’t “all caught up”; a retry in a moment usually clears it.";
  if (companiesScanned > 0 && capHit) {
    title = "No matches in the slice we searched.";
    body = `The scan is capped, so it only searched ${companiesScanned.toLocaleString()}${companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} companies — not the whole network. Raise scan depth (Refine search) or narrow your roles, then re-cast to look deeper.`;
  } else if (companiesScanned > 0 && droppedNoDate > 0) {
    title = "Fresh-looking roles were skipped for missing dates.";
    body = `${droppedNoDate.toLocaleString()} posting${droppedNoDate === 1 ? "" : "s"} matched but had no clear publish date, so the freshness filter dropped them. Widening the time window often brings dated equivalents back.`;
  } else if (companiesScanned > 0 && partial) {
    title = "Some job boards were unreachable.";
    body = `The scan searched ${companiesScanned.toLocaleString()} companies, but one or more sources didn’t respond — so this is a partial result, not “all caught up”. A retry usually clears it.`;
  }
  return (
    <div className="md3-alert md3-alert--warning flex-col items-stretch">
      <div className="flex items-start gap-3">
        <MaterialSymbol name="warning" size={20} className="shrink-0" />
        <div className="min-w-0">
          <p className="mb-1 md-title-small">{title}</p>
          <p className="mb-0 md-body-medium">{body}</p>
        </div>
      </div>
      <Md3ActionButton variant="filled" icon="refresh" className="mt-3 self-start" onClick={onRetry}>
        Retry the scan
      </Md3ActionButton>
    </div>
  );
}

function CappedBanner({
  companiesScanned,
  companiesAvailable,
  onRefine,
}: {
  companiesScanned: number;
  companiesAvailable: number;
  onRefine: () => void;
}) {
  return (
    <p className="md3-alert md3-alert--warning mb-4">
      <MaterialSymbol name="warning" size={20} className="shrink-0" />
      <span>
        Showing a capped slice — searched {companiesScanned.toLocaleString()}
        {companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} companies.{" "}
        <button type="button" className="md3-action-btn md3-action-btn--text px-0" onClick={onRefine}>
          Raise scan depth to search deeper
        </button>
      </span>
    </p>
  );
}

function FailedCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  const scannerMissing = /isn'?t available|data only|complete career-ops checkout|scanner/i.test(msg);
  if (scannerMissing) {
    return (
      <Md3Card>
        <Md3Empty icon="explore">
          <h4 className="mt-3 mb-1 md-title-medium">Discovery needs the full toolkit</h4>
          <p className="mb-0 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
            Your career-ops home looks data-only or is on an older version. The free scanner ships with a complete
            checkout — update career-ops, or paste a job URL on the pipeline to evaluate it directly.
          </p>
          <div className="md3-actions-row mt-4">
            <Link href="/pipeline" className="md3-action-btn md3-action-btn--filled">
              <span className="md3-action-btn__label">Open pipeline</span>
            </Link>
            <Link href="/config" className="md3-action-btn md3-action-btn--outlined">
              <span className="md3-action-btn__label">Open Config</span>
            </Link>
          </div>
        </Md3Empty>
      </Md3Card>
    );
  }
  return (
    <div className="md3-alert md3-alert--warning flex-col items-stretch">
      <div className="flex items-start gap-3">
        <MaterialSymbol name="warning" size={20} className="shrink-0" />
        <div className="min-w-0">
          <p className="mb-1 md-title-small">Couldn&apos;t finish the search.</p>
          <p className="mb-0 md-body-medium">{msg}</p>
        </div>
      </div>
      <Md3ActionButton icon="refresh" className="mt-3 self-start" onClick={onRetry}>
        Try again
      </Md3ActionButton>
    </div>
  );
}

function BlockedCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <Md3Card>
      <Md3Empty icon="bolt">
        <h4 className="mt-3 mb-1 md-title-medium">AI search needs a CLI</h4>
        <p className="mb-0 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
          Install and select Claude Code or Codex in Config — your key, your tokens, your machine. The free Scan works
          without one.
        </p>
        <div className="md3-actions-row mt-4">
          {onRetry && (
            <Md3ActionButton icon="refresh" onClick={onRetry}>
              Check again
            </Md3ActionButton>
          )}
          <Link href="/config" className="md3-action-btn md3-action-btn--filled">
            <MaterialSymbol name="settings" size={18} />
            <span className="md3-action-btn__label">Open Config</span>
          </Link>
        </div>
      </Md3Empty>
    </Md3Card>
  );
}
