"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/material-symbol";
import { CompanyLogo } from "@/components/company-logo";
import { PageShell } from "@/components/dossier/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Input, Md3Textarea } from "@/components/ui/md3-input";
import { Md3Select } from "@/components/ui/md3-select";
import { useJobs } from "@/components/jobs/job-store";
import { InterviewPracticeLab } from "@/components/interview/interview-practice-lab";
import { cn } from "@/lib/cn";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {
  AUDIENCE_OPTIONS,
  PROVENANCE_LABEL,
  PROV_ORDER,
  ROUND_TYPE_OPTIONS,
  extractAudiencePack,
  extractRoundSection,
  questionsForRound,
  roundProgress,
  type InterviewBundle,
  type InterviewRound,
  type QuestionBankRow,
  type QuestionProvenance,
} from "@/lib/interview-shared";

type RoundTab = "brief" | "questions" | "practice" | "debrief";
type GlobalTab = "intel" | "bank" | "stories" | "sessions" | "redflags";

const ROUND_TAB_ITEMS: { key: RoundTab; label: string; icon: string }[] = [
  { key: "brief", label: "Brief", icon: "description" },
  { key: "questions", label: "Questions", icon: "quiz" },
  { key: "practice", label: "Practice", icon: "mic" },
  { key: "debrief", label: "Debrief", icon: "rate_review" },
];

const GLOBAL_TAB_ITEMS: { key: GlobalTab; label: string; icon: string }[] = [
  { key: "intel", label: "Process & intel", icon: "manage_search" },
  { key: "bank", label: "Question bank", icon: "library_books" },
  { key: "stories", label: "Stories", icon: "auto_stories" },
  { key: "sessions", label: "Sessions", icon: "history" },
  { key: "redflags", label: "Red flags", icon: "flag" },
];

const STATUS_DOT: Record<string, string> = {
  planned: "bg-[var(--md-sys-color-outline)]",
  scheduled: "bg-[var(--md-sys-color-primary)]",
  done: "bg-[var(--md-sys-color-tertiary)]",
  cancelled: "bg-[var(--md-sys-color-error)]",
};
function statusBadge(status: QuestionBankRow["status"]) {
  if (status === "strong") return <Badge tone="good">Strong</Badge>;
  if (status === "solid") return <Badge tone="warn">Solid</Badge>;
  if (status === "gap") return <Badge tone="bad">Gap</Badge>;
  return null;
}

function roundIcon(type: string): string {
  if (type === "screen") return "support_agent";
  if (type === "hiring-manager") return "person";
  if (type === "technical") return "code";
  if (type === "system-design") return "architecture";
  if (type === "behavioral") return "groups";
  if (type === "onsite") return "domain";
  if (type === "final") return "emoji_events";
  return "event";
}

function formatCountdown(iso: string, now: number): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = t - now;
  if (diff < 0) return "Past due";
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `in ${hrs}h`;
  return "soon";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatWhen(iso: string): string {
  if (!iso) return "Not scheduled";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  const hour = Number(m[4]);
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "pm" : "am";
  return `${Number(m[3])} ${month} ${m[1]}, ${h12}:${m[5]} ${ampm} PKT`;
}

function defaultRoundNo(rounds: InterviewRound[]): number {
  const next = rounds.find((r) => r.status === "scheduled") ?? rounds.find((r) => r.status === "planned");
  return next?.roundNo ?? rounds[0]?.roundNo ?? 1;
}

function statusLabel(status: string): string {
  if (status === "scheduled") return "Scheduled";
  if (status === "done") return "Done";
  if (status === "cancelled") return "Cancelled";
  return "Planned";
}

export function InterviewWorkspace({ id, initial }: { id: string; initial: InterviewBundle }) {
  const { jobs, startJob } = useJobs();
  const [bundle, setBundle] = useState(initial);
  const [selectedRound, setSelectedRound] = useState(() => defaultRoundNo(initial.rounds));
  const [roundTab, setRoundTab] = useState<RoundTab>("brief");
  const [globalTab, setGlobalTab] = useState<GlobalTab | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState<QuestionProvenance | "all">("all");
  const [bankQuery, setBankQuery] = useState("");

  const [planAt, setPlanAt] = useState("");
  const [planInterviewers, setPlanInterviewers] = useState("");

  const [debriefNotes, setDebriefNotes] = useState("");
  const [debriefOutcome, setDebriefOutcome] = useState("pending");
  const [debriefNext, setDebriefNext] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const editDialogRef = useRef<HTMLElement>(null);
  useDialogFocus(editOpen, editDialogRef);
  const [editRound, setEditRound] = useState<Partial<InterviewRound>>({});
  const editTitleRef = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!editOpen) return;
    editTitleRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editOpen]);

  const reload = useCallback(() => {
    fetch(`/api/interview?n=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: InterviewBundle) => {
        setBundle(d);
        if (!d.rounds.some((r) => r.roundNo === selectedRound) && d.rounds[0]) {
          setSelectedRound(d.rounds[0].roundNo);
        }
      })
      .catch(() => {});
  }, [id, selectedRound]);

  useEffect(() => {
    const onDone = () => reload();
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [reload]);

  const progress = useMemo(() => roundProgress(bundle.rounds), [bundle.rounds]);
  const activeRound = bundle.rounds.find((r) => r.roundNo === selectedRound) ?? null;
  const roundQuestions = useMemo(
    () => (activeRound ? questionsForRound(bundle.questions, activeRound) : []),
    [activeRound, bundle.questions],
  );

  useEffect(() => {
    if (!activeRound) return;
    setPlanAt(activeRound.scheduledAt);
    setPlanInterviewers(activeRound.interviewers);
  }, [activeRound]);

  const filteredBank = useMemo(() => {
    let rows = bundle.questions;
    if (bankFilter !== "all") rows = rows.filter((q) => q.sourceTier === bankFilter);
    const q = bankQuery.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.question.toLowerCase().includes(q));
    return rows;
  }, [bundle.questions, bankFilter, bankQuery]);

  const runningInterview = jobs.some(
    (j) => j.input === id && j.status === "running" && (j.kind ?? "").startsWith("interview"),
  );
  const latestPracticeJob = jobs.find((job) => job.input === id && job.kind === "interview-practice");

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const run = (kind: string, title: string, context?: Record<string, unknown>) => {
    const jobId = startJob({
      title,
      subtitle: bundle.role,
      kind,
      input: id,
      page: `/pipeline/${id}/interview`,
      context,
    });
    if (jobId) flash(`Started ${title.toLowerCase()} — check Workers.`);
  };

  const saveRound = async () => {
    const roundNo = editRound.roundNo ?? Math.max(0, ...bundle.rounds.map((round) => round.roundNo)) + 1;
    const res = await fetch("/api/interview/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", trackerNum: id, round: { ...editRound, roundNo } }),
    });
    if (!res.ok) {
      flash("Could not save round");
      return;
    }
    setEditOpen(false);
    reload();
  };

  const importRounds = async () => {
    const res = await fetch("/api/interview/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", trackerNum: id }),
    });
    if (res.ok) reload();
  };

  const groupedQuestions = useMemo(() => {
    const map = new Map<QuestionProvenance, QuestionBankRow[]>();
    for (const tier of PROV_ORDER) map.set(tier, []);
    for (const q of roundQuestions) {
      const list = map.get(q.sourceTier) ?? [];
      list.push(q);
      map.set(q.sourceTier, list);
    }
    return map;
  }, [roundQuestions]);

  const briefMd = useMemo(() => {
    if (!bundle.prepContent || !activeRound) return "";
    const section = extractRoundSection(bundle.prepContent, activeRound.roundNo);
    const pack = extractAudiencePack(bundle.prepContent, activeRound.audience);
    return [section, pack].filter(Boolean).join("\n\n");
  }, [bundle.prepContent, activeRound]);

  return (
    <PageShell width="wide" className="interview-workspace">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
        <Link href="/pipeline" className="inline-flex items-center gap-1 hover:text-[var(--md-sys-color-primary)]">
          <MaterialSymbol name="arrow_back" size={18} />
          Pipeline
        </Link>
        <span>/</span>
        <Link href={`/pipeline/${id}`} className="hover:text-[var(--md-sys-color-primary)]">
          #{id}
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--md-sys-color-on-surface)]">Interview</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-start gap-4">
        <CompanyLogo name={bundle.company} size={56} className="rounded-[var(--md-sys-shape-corner-large)]" />
        <div className="min-w-0 flex-1">
          <h1 className="md-headline-small truncate text-[var(--md-sys-color-on-surface)]">{bundle.company}</h1>
          <p className="truncate text-[var(--md-sys-color-on-surface-variant)]">{bundle.role}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {progress.total > 0 ? (
              <Badge tone="muted">
                Round {Math.min(progress.done + 1, progress.total)} of {progress.total}
              </Badge>
            ) : (
              <Badge tone="muted">No rounds yet</Badge>
            )}
            {progress.next?.scheduledAt ? (
              <Badge tone="warn">Next: {formatWhen(progress.next.scheduledAt)}{now ? ` · ${formatCountdown(progress.next.scheduledAt, now)}` : ""}</Badge>
            ) : null}
            {bundle.statedComp.map((s) => (
              <Badge key={`${s.date}-${s.amount}`} tone="warn">
                Stated {s.amount} {s.currency} ({s.round || "round ?"})
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!bundle.prepContent ? (
            <Button onClick={() => run("interview-prep", `Interview prep · ${bundle.company}`)} disabled={runningInterview}>
              <MaterialSymbol name="psychology" size={18} />
              Generate prep
            </Button>
          ) : (
            <Button variant="outline" onClick={() => run("interview-prep", `Refresh prep · ${bundle.company}`)} disabled={runningInterview}>
              <MaterialSymbol name="refresh" size={18} />
              Refresh prep
            </Button>
          )}
          <Button variant="outline" onClick={() => run("interview-questions", `Mine questions · ${bundle.company}`, { scope: "mine" })} disabled={runningInterview}>
            <MaterialSymbol name="search" size={18} />
            Mine questions
          </Button>
        </div>
      </header>

      {notice ? (
        <p className="md3-alert md3-alert--info mb-4">{notice}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="md-title-small text-[var(--md-sys-color-on-surface)]">Rounds</h2>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Import rounds from prep"
                onClick={() => void importRounds()}
              >
                <MaterialSymbol name="download" size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Add round"
                onClick={() => {
                  setEditRound({
                    roundNo: Math.max(0, ...bundle.rounds.map((item) => item.roundNo)) + 1,
                    type: "screen",
                    audience: "recruiter-screen",
                    status: "planned",
                    outcome: "pending",
                  });
                  setEditOpen(true);
                }}
              >
                <MaterialSymbol name="add" size={18} />
              </Button>
            </div>
          </div>

          {bundle.rounds.length === 0 ? (
            <Md3Empty icon="event" description="No rounds yet. Generate prep or add a round." />
          ) : (
            <ul className="space-y-1">
              {bundle.rounds.map((round) => {
                const qCount = questionsForRound(bundle.questions, round).length;
                const gapCount = questionsForRound(bundle.questions, round).filter((q) => q.status === "gap").length;
                const active = round.roundNo === selectedRound && !globalTab;
                return (
                  <li key={round.roundNo}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] px-2 py-2 text-left transition-colors",
                        active
                          ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                          : "hover:bg-[var(--md-sys-color-surface-container-highest)]",
                      )}
                      onClick={() => {
                        setSelectedRound(round.roundNo);
                        setGlobalTab(null);
                      }}
                    >
                      <MaterialSymbol name={roundIcon(round.type)} size={20} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[round.status] ?? STATUS_DOT.planned)} />
                          <span className="truncate text-sm font-medium">R{round.roundNo} · {ROUND_TYPE_OPTIONS.find((o) => o.value === round.type)?.label ?? round.type}</span>
                        </div>
                        <p className="truncate text-xs opacity-80">
                          {round.interviewers || ROUND_TYPE_OPTIONS.find((o) => o.value === round.type)?.label || round.audience}
                        </p>
                        <p className="truncate text-xs opacity-70">
                          {round.scheduledAt ? formatWhen(round.scheduledAt) : statusLabel(round.status)}
                          {qCount > 0 ? ` · ${qCount} Q` : ""}
                          {gapCount > 0 ? ` · ${gapCount} gaps` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--md-sys-color-outline-variant)] pb-2">
            {GLOBAL_TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[var(--md-sys-shape-corner-full)] px-3 py-1.5 text-sm",
                  globalTab === tab.key
                    ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]",
                )}
                onClick={() => setGlobalTab(tab.key)}
              >
                <MaterialSymbol name={tab.icon} size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {globalTab ? (
            <GlobalPane
              tab={globalTab}
              bundle={bundle}
              filteredBank={filteredBank}
              bankFilter={bankFilter}
              bankQuery={bankQuery}
              onBankFilter={setBankFilter}
              onBankQuery={setBankQuery}
              running={runningInterview}
              onRun={run}
              hasSessions={bundle.sessions.length > 0}
            />
          ) : activeRound ? (
            <>
              <div className="mb-4 flex flex-wrap gap-1">
                {ROUND_TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[var(--md-sys-shape-corner-full)] px-3 py-1.5 text-sm",
                      roundTab === tab.key
                        ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                        : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]",
                    )}
                    onClick={() => setRoundTab(tab.key)}
                  >
                    <MaterialSymbol name={tab.icon} size={16} />
                    {tab.label}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setEditRound({ ...activeRound });
                    setEditOpen(true);
                  }}
                >
                  <MaterialSymbol name="edit" size={16} />
                  Edit round
                </Button>
              </div>

              {roundTab === "brief" ? (
                <div className="space-y-4">
                  <Md3Card
                    title={<span className="md-title-small">Round {activeRound.roundNo} · {ROUND_TYPE_OPTIONS.find((o) => o.value === activeRound.type)?.label ?? activeRound.type}</span>}
                    extra={<Badge tone={activeRound.status === "scheduled" ? "warn" : activeRound.status === "done" ? "good" : "muted"}>{statusLabel(activeRound.status)}</Badge>}
                  >
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">When</dt>
                        <dd className="text-sm text-[var(--md-sys-color-on-surface)]">
                          {activeRound.scheduledAt ? `${formatWhen(activeRound.scheduledAt)}${activeRound.durationMin ? ` · ${activeRound.durationMin} min` : ""}` : "Not scheduled"}
                          {activeRound.scheduledAt && activeRound.status === "scheduled" && now ? (
                            <span className="ml-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">{formatCountdown(activeRound.scheduledAt, now)}</span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Interviewers</dt>
                        <dd className="text-sm text-[var(--md-sys-color-on-surface)]">{activeRound.interviewers || "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Format</dt>
                        <dd className="text-sm text-[var(--md-sys-color-on-surface)]">{activeRound.format || "—"}</dd>
                      </div>
                      {activeRound.notes ? (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Focus</dt>
                          <dd className="text-sm leading-relaxed text-[var(--md-sys-color-on-surface)]">{activeRound.notes}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </Md3Card>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={runningInterview}
                      onClick={() =>
                        run("interview-plan", `Plan · R${activeRound.roundNo}`, {
                          round: activeRound.roundNo,
                          roundType: activeRound.type,
                          audience: activeRound.audience,
                          scheduledAt: planAt || activeRound.scheduledAt,
                          interviewers: planInterviewers || activeRound.interviewers,
                        })
                      }
                    >
                      <MaterialSymbol name="schedule" size={18} />
                      Build prep plan
                    </Button>
                  </div>
                  {briefMd ? (
                    <article className="report-prose-compact rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] p-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefMd}</ReactMarkdown>
                    </article>
                  ) : (
                    <Md3Empty icon="description" description="No written brief for this round yet. The card above is from the round ledger." />
                  )}
                </div>
              ) : null}

              {roundTab === "questions" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={runningInterview} onClick={() => run("interview-questions", `Mine · R${activeRound.roundNo}`, { scope: "mine", round: activeRound.roundNo })}>
                      Mine more
                    </Button>
                    <Button variant="outline" disabled={runningInterview} onClick={() => run("interview-questions", `Variants · R${activeRound.roundNo}`, { scope: "variants", round: activeRound.roundNo })}>
                      Add drill variants
                    </Button>
                  </div>
                  {roundQuestions.length === 0 ? (
                    <Md3Empty icon="quiz" description="No questions for this round yet. Run Mine questions." />
                  ) : (
                    PROV_ORDER.map((tier) => {
                      const rows = groupedQuestions.get(tier) ?? [];
                      if (rows.length === 0) return null;
                      return (
                        <section key={tier}>
                          <h3 className="mb-2 md-title-small text-[var(--md-sys-color-on-surface)]">{PROVENANCE_LABEL[tier]}</h3>
                          <ul className="space-y-2">
                            {rows.map((q) => (
                              <li key={q.num} className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-3">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-[var(--md-sys-color-outline)]">Q{q.num}</span>
                                  {statusBadge(q.status)}
                                  <Badge tone="muted">{q.roundLabel || activeRound.type}</Badge>
                                </div>
                                <p className="text-sm text-[var(--md-sys-color-on-surface)]">{q.question}</p>
                                <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">{q.source}</p>
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })
                  )}
                </div>
              ) : null}

              {roundTab === "practice" ? (
                <InterviewPracticeLab
                  trackerNum={id}
                  round={activeRound}
                  questions={roundQuestions}
                  latestJob={latestPracticeJob}
                  running={runningInterview}
                  onRun={run}
                />
              ) : null}

              {roundTab === "debrief" ? (
                <div className="space-y-4">
                  <Md3Textarea
                    aria-label="Debrief notes"
                    placeholder="What was asked, how you answered, interviewer reactions…"
                    value={debriefNotes}
                    onChange={(e) => setDebriefNotes(e.target.value)}
                    className="min-h-[160px]"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Md3Select
                      aria-label="Outcome"
                      value={debriefOutcome}
                      onChange={setDebriefOutcome}
                      options={[
                        { value: "pending", label: "Pending" },
                        { value: "advanced", label: "Advanced" },
                        { value: "rejected", label: "Rejected" },
                      ]}
                    />
                    <Md3Input placeholder="Next round details (optional)" value={debriefNext} onChange={(e) => setDebriefNext(e.target.value)} />
                  </div>
                  <Button
                    disabled={runningInterview || !debriefNotes.trim()}
                    onClick={() =>
                      run("interview-debrief", `Debrief · R${activeRound.roundNo}`, {
                        round: activeRound.roundNo,
                        roundType: activeRound.type,
                        questionsAsked: debriefNotes,
                        outcome: debriefOutcome,
                        nextRound: debriefNext,
                      })
                    }
                  >
                    <MaterialSymbol name="save" size={18} />
                    Save debrief
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <Md3Empty icon="event" description="Select a round or open a global tab." />
          )}
        </main>
      </div>

      {editOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" aria-hidden onClick={() => setEditOpen(false)} />
          <aside
            ref={editDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-round-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-4 shadow-xl"
          >
            <h2 id="edit-round-title" ref={editTitleRef} tabIndex={-1} className="mb-4 md-title-medium">Edit round</h2>
            <div className="flex-1 space-y-3 overflow-y-auto">
              <Md3Select
                aria-label="Round type"
                value={editRound.type ?? "screen"}
                onChange={(v) => setEditRound({ ...editRound, type: v as InterviewRound["type"] })}
                options={ROUND_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <Md3Select
                aria-label="Audience"
                value={editRound.audience ?? "recruiter-screen"}
                onChange={(v) => setEditRound({ ...editRound, audience: v as InterviewRound["audience"] })}
                options={AUDIENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <Md3Select
                aria-label="Status"
                value={editRound.status ?? "planned"}
                onChange={(v) => setEditRound({ ...editRound, status: v as InterviewRound["status"] })}
                options={[
                  { value: "planned", label: "Planned" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "done", label: "Done" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
              <Md3Input type="datetime-local" value={editRound.scheduledAt ?? ""} onChange={(e) => setEditRound({ ...editRound, scheduledAt: e.target.value })} aria-label="Scheduled at" />
              <Md3Input
                type="number"
                min={0}
                max={1440}
                aria-label="Duration in minutes"
                placeholder="Duration in minutes"
                value={String(editRound.durationMin ?? "")}
                onChange={(e) => setEditRound({ ...editRound, durationMin: Number(e.target.value) || 0 })}
              />
              <Md3Select
                aria-label="Outcome"
                value={editRound.outcome ?? "pending"}
                onChange={(value) => setEditRound({ ...editRound, outcome: value as InterviewRound["outcome"] })}
                options={[
                  { value: "pending", label: "Outcome pending" },
                  { value: "advanced", label: "Advanced" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
              <Md3Input aria-label="Interviewers" placeholder="Interviewers" value={editRound.interviewers ?? ""} onChange={(e) => setEditRound({ ...editRound, interviewers: e.target.value })} />
              <Md3Input aria-label="Format notes" placeholder="Format notes" value={editRound.format ?? ""} onChange={(e) => setEditRound({ ...editRound, format: e.target.value })} />
              <Md3Textarea aria-label="Round notes" placeholder="Notes" value={editRound.notes ?? ""} onChange={(e) => setEditRound({ ...editRound, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => void saveRound()}>Save</Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </aside>
        </>
      ) : null}
    </PageShell>
  );
}

function GlobalPane({
  tab,
  bundle,
  filteredBank,
  bankFilter,
  bankQuery,
  onBankFilter,
  onBankQuery,
  running,
  onRun,
  hasSessions,
}: {
  tab: GlobalTab;
  bundle: InterviewBundle;
  filteredBank: QuestionBankRow[];
  bankFilter: QuestionProvenance | "all";
  bankQuery: string;
  onBankFilter: (v: QuestionProvenance | "all") => void;
  onBankQuery: (v: string) => void;
  running: boolean;
  onRun: (kind: string, title: string, context?: Record<string, unknown>) => void;
  hasSessions: boolean;
}) {
  if (tab === "intel") {
    return bundle.prepContent ? (
      <article className="report-prose-compact rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{bundle.prepContent}</ReactMarkdown>
      </article>
    ) : (
      <Md3Empty icon="manage_search" description="No prep file yet. Generate prep from the header." />
    );
  }

  if (tab === "bank") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Md3Input placeholder="Search questions…" value={bankQuery} onChange={(e) => onBankQuery(e.target.value)} className="min-w-[200px] flex-1" />
          <Md3Select
            aria-label="Provenance filter"
            value={bankFilter}
            onChange={(v) => onBankFilter(v as QuestionProvenance | "all")}
            options={[{ value: "all", label: "All sources" }, ...PROV_ORDER.map((p) => ({ value: p, label: PROVENANCE_LABEL[p] }))]}
          />
        </div>
        {filteredBank.length === 0 ? (
          <Md3Empty icon="library_books" description="Question bank is empty. Run Mine questions." />
        ) : (
          <ul className="space-y-2">
            {filteredBank.map((q) => (
              <li key={q.num} className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone="muted">Q{q.num}</Badge>
                  {statusBadge(q.status)}
                  <Badge tone="muted">{PROVENANCE_LABEL[q.sourceTier]}</Badge>
                </div>
                <p className="text-sm">{q.question}</p>
                <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">{q.source}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (tab === "stories") {
    return bundle.storyBankContent ? (
      <article className="report-prose-compact rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{bundle.storyBankContent}</ReactMarkdown>
      </article>
    ) : (
      <Md3Empty icon="auto_stories" description="No story bank yet. Build stories in interview prep or chat." />
    );
  }

  if (tab === "sessions") {
    return bundle.sessions.length === 0 ? (
      <Md3Empty icon="history" description="No session transcripts yet. Practice or debrief to create one." />
    ) : (
      <ul className="space-y-2">
        {bundle.sessions.map((s) => (
          <li key={s.file} className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">{s.date}</Badge>
              <Badge tone="muted">{s.round}</Badge>
              <Badge tone="muted">{s.source}</Badge>
            </div>
            <p className="mt-1 text-sm">{s.file}</p>
          </li>
        ))}
      </ul>
    );
  }

  if (tab === "redflags") {
    if (!hasSessions) {
      return (
        <Md3Empty
          icon="flag"
          description="Red-flag analysis needs at least one session transcript from a debrief or practice run."
        />
      );
    }
    return (
      <div className="space-y-4">
        <Button variant="outline" disabled={running} onClick={() => onRun("interview-redflag", `Red flags · ${bundle.company}`)}>
          <MaterialSymbol name="flag" size={18} />
          Analyze red flags
        </Button>
        {bundle.redflagsContent ? (
          <article className="report-prose-compact rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{bundle.redflagsContent}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">No red-flag report yet.</p>
        )}
      </div>
    );
  }

  return null;
}
