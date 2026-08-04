"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CompassOutlined,
  ReloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { Alert, Button, Card, Collapse, Empty, Space, Tag, Typography } from "antd";
import type { Application, InboxJob } from "@/lib/career-ops";
import { paramsToFilters, paramsToAi, type ExploreFilters } from "@/lib/explore";
import { useCliConfig, resolveCliIdForRun } from "@/lib/cli-config";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { FilterBuilder } from "./filter-builder";
import { DiscoveringState } from "./discovering-state";
import { AiHuntView } from "./ai-hunt-view";
import { ExploreModeToggle } from "./explore-mode-toggle";
import { AiSearchBox } from "./ai-search-box";
import { ResultsList, type EnrichedOffer } from "./results-list";
import { useExplore } from "./explore-provider";

const { Title, Paragraph, Text } = Typography;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function ExplorerView({
  seed,
  inboxSnapshot,
  appsSnapshot,
  rootExists,
}: {
  seed: { filters: ExploreFilters; seededFrom: string[] };
  inboxSnapshot: InboxJob[];
  appsSnapshot: Application[];
  rootExists: boolean;
}) {
  const { filters, setFilters, initFilters, phase, running, offers, discover, status, error, mode, setMode, aiIntent, setAiIntent, discoverAI, companiesScanned, companiesAvailable, capHit, droppedNoDate, partial } = useExplore();
  const scanNote =
    companiesScanned > 0
      ? `Scanned ${companiesScanned.toLocaleString()}${companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} compan${companiesScanned === 1 ? "y" : "ies"}${partial ? " · some sources were unreachable" : ""}.`
      : undefined;
  const inited = useRef(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const { cliName, cliConfigured } = useCliConfig();
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const sp = new URLSearchParams(window.location.search);
    const ai = paramsToAi(sp);
    if (ai !== null) {
      setMode("ai");
      setAiIntent(ai);
    } else {
      initFilters(sp.toString() ? paramsToFilters(sp) : seed.filters);
      // Onboarding hand-off: ?run=1 auto-fires the free scan + flags the first-run
      // banner (the "matches found from your CV, free" reveal).
      if (sp.get("run") === "1") {
        setFirstRun(true);
        void discover();
      }
    }
  }, [seed.filters, initFilters, setMode, setAiIntent, discover]);

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
  const isResults = phase === "results";

  return (
    <PageShell width="default">
      <DossierStack>
      <header>
        <div className="flex flex-wrap items-center gap-4">
          <Space>
            <CompassOutlined className="text-xl text-[var(--ant-color-primary)]" />
            <Title level={2} className="!mb-0 !font-display">
              Explore
            </Title>
            <Tag color="orange">New</Tag>
          </Space>
          <div className="w-full sm:ml-auto sm:w-auto">
            <ExploreModeToggle mode={mode} onChange={setMode} cliConfigured={cliConfigured} />
          </div>
        </div>
        {!isResults && (
          <Paragraph type="secondary" className="!mt-3 max-w-2xl">
            {isAi
              ? "Describe the role in plain language — an AI hunts the open web for it, on your own AI. Candidates are unverified until you evaluate."
              : "Scan the public ATS network — Greenhouse, Lever, Ashby, Workday. Fresh postings matched to you, zero tokens. You only spend when you choose to evaluate one."}
          </Paragraph>
        )}
      </header>

      {!rootExists && (
        <Alert
          className="mb-5"
          type="warning"
          showIcon
          message="Your career-ops home isn't set up yet — discovery needs a checkout with a profile to seed from."
        />
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
              onSubmit={() => void discoverAI()}
              cliConfigured={cliConfigured}
              cliName={cliName}
              onRunScan={() => setMode("scan")}
            />
            {phase === "results" && <ResultsList offers={enriched} />}
            {phase === "empty-loose" && (
              <EmptyState
                tone="loose"
                title="No public matches — yet."
                body="AI search reads what's public. Try broader intent, or run the free Scan over the ATS network."
                onRerun={() => setMode("scan")}
                rerunLabel="Run the free Scan"
              />
            )}
            {phase === "failed" && <FailedCard msg={error || status} onRetry={() => void discoverAI()} />}
          </div>
        )
      ) : (
        <>
          {isResults ? (
            <Collapse
              className="mb-6"
              items={[
                {
                  key: "refine",
                  label: (
                    <Space>
                      <CompassOutlined />
                      Refine search
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" className="w-full" size={16}>
                      <FilterBuilder filters={filters} onChange={setFilters} seededFrom={seed.seededFrom} />
                      <DiscoverBar canDiscover={canDiscover} onDiscover={discover} label="Re-cast (free)" />
                    </Space>
                  ),
                },
              ]}
              activeKey={refineOpen ? ["refine"] : []}
              onChange={(keys) => setRefineOpen(keys.includes("refine"))}
            />
          ) : (
            <Card className="mb-6">
              <FilterBuilder filters={filters} onChange={setFilters} seededFrom={seed.seededFrom} />
              <div className="mt-5">
                <DiscoverBar canDiscover={canDiscover} onDiscover={discover} label="Discover (free)" />
              </div>
            </Card>
          )}

          {isResults && firstRun && (
            <Alert
              className="mb-4"
              type="success"
              showIcon
              icon={<ThunderboltOutlined />}
              message={
                <>
                  These are live roles that match your CV.{" "}
                  <Text type="success">Nothing here cost you a token.</Text> Pick the one you&apos;re most curious about
                  — Evaluate it and I&apos;ll tell you exactly how you score, and why.
                </>
              }
            />
          )}

          {isResults && capHit && (
            <CappedBanner companiesScanned={companiesScanned} companiesAvailable={companiesAvailable} onRefine={() => setRefineOpen(true)} />
          )}
          {isResults && <ResultsList offers={enriched} />}

          {phase === "empty-current" && (
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
          {phase === "empty-loose" && (
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
          {phase === "degraded" && (
            <DegradedCard
              onRetry={() => void discover()}
              companiesScanned={companiesScanned}
              companiesAvailable={companiesAvailable}
              capHit={capHit}
              droppedNoDate={droppedNoDate}
              partial={partial}
            />
          )}
          {phase === "failed" && <FailedCard msg={error || status} onRetry={() => void discover()} />}
        </>
      )}
      </DossierStack>
    </PageShell>
  );
}

function DiscoverBar({ canDiscover, onDiscover, label }: { canDiscover: boolean; onDiscover: () => void; label: string }) {
  return (
    <Space wrap>
      <Button type="primary" icon={<CompassOutlined />} disabled={!canDiscover} onClick={onDiscover}>
        {label}
      </Button>
      <Text type="secondary" className="text-xs">
        Evaluating a role later costs tokens. Discovering never does.
      </Text>
    </Space>
  );
}

function EmptyState({ tone, title, body, note, onRerun, rerunLabel }: { tone: "good" | "loose"; title: string; body: string; note?: string; onRerun: () => void; rerunLabel: string }) {
  return (
    <Card>
      <Empty
        image={<ThunderboltOutlined className={tone === "good" ? "text-emerald-500" : "text-[var(--ant-color-primary)]"} style={{ fontSize: 48 }} />}
        description={
          <>
            <Title level={4} className="!font-display">
              {title}
            </Title>
            <Paragraph type="secondary">{body}</Paragraph>
            {note && <Text type="secondary" className="text-xs">{note}</Text>}
          </>
        }
      >
        <Button icon={<ReloadOutlined />} onClick={onRerun}>
          {rerunLabel}
        </Button>
      </Empty>
    </Card>
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
  // 0 results, but the scan was NOT a clean full search → never "all caught up".
  // Pick the most informative reason (authoritative when the scanner's --json mode
  // is available; otherwise the 0-companies fallback).
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
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      message={title}
      description={
        <>
          <Paragraph className="!mb-2">{body}</Paragraph>
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
            Retry the scan
          </Button>
        </>
      }
    />
  );
}

function CappedBanner({ companiesScanned, companiesAvailable, onRefine }: { companiesScanned: number; companiesAvailable: number; onRefine: () => void }) {
  return (
    <Alert
      className="mb-4"
      type="warning"
      showIcon
      message={
        <>
          Showing a capped slice — searched {companiesScanned.toLocaleString()}
          {companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} companies.{" "}
          <Button type="link" size="small" onClick={onRefine} className="px-0">
            Raise scan depth to search deeper
          </Button>
        </>
      }
    />
  );
}

function FailedCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  const scannerMissing = /isn'?t available|data only|complete career-ops checkout|scanner/i.test(msg);
  if (scannerMissing) {
    return (
      <Card>
        <Empty
          image={<CompassOutlined style={{ fontSize: 48, color: "var(--ant-color-primary)" }} />}
          description={
            <>
              <Title level={4} className="!font-display">
                Discovery needs the full toolkit
              </Title>
              <Paragraph type="secondary">
                Your career-ops home looks data-only or is on an older version. The free scanner ships with a complete
                checkout — update career-ops, or paste a job URL on the pipeline to evaluate it directly.
              </Paragraph>
            </>
          }
        >
          <Space>
            <Link href="/pipeline">
              <Button type="primary">Open pipeline</Button>
            </Link>
            <Link href="/config">
              <Button>Open Config</Button>
            </Link>
          </Space>
        </Empty>
      </Card>
    );
  }
  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      message="Couldn't finish the search."
      description={
        <>
          <Paragraph className="!mb-2">{msg}</Paragraph>
          <Button icon={<ReloadOutlined />} onClick={onRetry}>
            Try again
          </Button>
        </>
      }
    />
  );
}

function BlockedCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card>
      <Empty
        image={<ThunderboltOutlined style={{ fontSize: 48, color: "var(--ant-color-primary)" }} />}
        description={
          <>
            <Title level={4} className="!font-display">
              AI search needs a CLI
            </Title>
            <Paragraph type="secondary">
              Install and select Claude Code or Codex in Config — your key, your tokens, your machine. The free Scan
              works without one.
            </Paragraph>
          </>
        }
      >
        <Space>
          {onRetry && (
            <Button icon={<ReloadOutlined />} onClick={onRetry}>
              Check again
            </Button>
          )}
          <Link href="/config">
            <Button type="primary" icon={<SettingOutlined />}>
              Open Config
            </Button>
          </Link>
        </Space>
      </Empty>
    </Card>
  );
}
