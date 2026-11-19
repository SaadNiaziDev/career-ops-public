"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useToast } from "@/components/providers/toast-provider";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { useApply } from "@/components/apply/apply-provider";
import { cn } from "@/lib/cn";
import { coverNeed as coverNeedOf, isCoverField, needsInput, plainText, type ApplyKit, type CoverNeed, type StepState } from "@/lib/apply/kit";
import type { SnapshotField, SnapshotState } from "@/lib/apply/snapshot";
import { ApplyAnswers, type EditableField } from "./apply-answers";
import { ActivityComposer } from "@/components/applications/activity-composer";
import { RoleEmailPanel } from "./role-email-panel";
import { useCopy } from "./use-copy";

const CONFIG_KEY = "career-ops:config";
const OPENED_KEY = "career-ops:apply-opened";

function hasCli(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}").cliId;
  } catch {
    return false;
  }
}

function readOpened(n: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(OPENED_KEY) || "[]") as string[]).includes(n);
  } catch {
    return false;
  }
}

function rememberOpened(n: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(OPENED_KEY) || "[]") as string[]).filter((x) => x !== n);
    localStorage.setItem(OPENED_KEY, JSON.stringify([n, ...list].slice(0, 50)));
  } catch {
    /* per-viewer convenience only */
  }
}

function latestJob(jobs: Job[], kind: string, n: string): Job | undefined {
  return jobs.filter((j) => j.kind === kind && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0];
}

function isApplied(status: string): boolean {
  return /applied|responded|interview|offer|rejected/i.test(status);
}

function host(url?: string): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function lastStep(job?: Job): string {
  return job?.steps.at(-1)?.label ?? "Working…";
}

async function postSnapshot(kit: ApplyKit, state: SnapshotState, fields: SnapshotField[]): Promise<boolean> {
  const vacancyUrl = kit.answers.vacancyUrl || kit.app.url;
  if (!vacancyUrl || fields.length === 0) return false;
  const res = await fetch("/api/apply/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackerNum: kit.app.n, vacancyUrl, state, fields }),
  }).catch(() => null);
  return !!res?.ok;
}

function toSnapshotFields(fields: EditableField[]): SnapshotField[] {
  return fields.map(({ id, label, value, type, source }) => ({ id, label, value, type, source }));
}

export function ApplyKitPanel({ initialKit }: { initialKit: ApplyKit }) {
  const n = initialKit.app.n;
  const { toast } = useToast();
  const copy = useCopy();
  const { jobs, startJob } = useJobs();
  const apply = useApply();
  const [kit, setKit] = useState(initialKit);
  const [status, setStatus] = useState(initialKit.app.status);
  const [open, setOpen] = useState<"answers" | "cover" | null>(null);
  const [draft, setDraft] = useState<EditableField[]>(() => editable(initialKit.answers.fields));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [coverText, setCoverText] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [cli, setCli] = useState(true);
  const [wantCover, setWantCover] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    setOpened(readOpened(n));
    setCli(hasCli());
  }, [n]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/apply/kit?n=${encodeURIComponent(n)}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { kit?: ApplyKit };
    if (!data.kit) return;
    setKit(data.kit);
    if (!dirty.current) setDraft(editable(data.kit.answers.fields));
  }, [n]);

  // Workers finishing (CV, cover) → re-read the kit from disk.
  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: string; input?: string }>).detail;
      if (!detail || detail.input === n) void refresh();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [n, refresh]);

  // ── Live form session (provider) for THIS tracker row ──────────────────────
  const live = apply.trackerNum === n && apply.status !== "idle";
  const liveReading = live && (apply.status === "opening" || apply.status === "driving");
  const liveDrafting = live && apply.status === "prefilling";
  const liveFilling = live && apply.status === "filling";
  const liveFields: EditableField[] | null = useMemo(() => {
    if (!live || apply.fields.length === 0) return null;
    return apply.fields.map((f) => ({
      key: f.id,
      id: f.id,
      label: f.label || f.nativeName || f.id,
      type: f.type,
      value: apply.answers[f.id] ?? "",
      source: apply.answers[f.id] ? "ai" : "form",
      options: f.options,
      required: f.required,
    }));
  }, [live, apply.fields, apply.answers]);
  const fields = liveFields ?? draft;

  // The provider autosaves a draft snapshot after drafting → pick it up.
  useEffect(() => {
    if (live && apply.snapshotState && !apply.snapshotSaving) void refresh();
  }, [live, apply.snapshotState, apply.snapshotSaving, refresh]);

  const cvJob = latestJob(jobs, "pdf", n);
  const coverJob = latestJob(jobs, "cover", n);
  const cvRunning = cvJob?.status === "running";
  const coverRunning = coverJob?.status === "running";
  const answersStats = useMemo(() => {
    const usable = fields.filter((f) => f.type !== "file");
    return { answered: usable.filter((f) => f.value.trim()).length, total: usable.length, flagged: usable.filter(needsInput).length };
  }, [fields]);
  const coverNeed: CoverNeed = liveFields ? coverNeedOf(liveFields, true) : kit.cover.need;
  const formUrl = kit.answers.vacancyUrl || kit.app.url;
  const applied = isApplied(status);

  const steps: Record<"cv" | "answers" | "cover" | "open" | "applied", StepState> = {
    cv: cvRunning ? "running" : kit.cv.ready ? "done" : "todo",
    answers: liveReading || liveDrafting ? "running" : answersStats.answered > 0 ? "done" : formUrl ? "todo" : "blocked",
    cover: coverRunning ? "running" : kit.cover.ready ? "done" : coverNeed === "none" ? "skipped" : "todo",
    open: !formUrl ? "blocked" : liveFilling ? "running" : opened || applied || (live && apply.status === "done") ? "done" : "todo",
    applied: applied ? "done" : "todo",
  };
  const counted = (["cv", "answers", "cover"] as const).filter((k) => steps[k] !== "skipped");
  const doneCount = counted.filter((k) => steps[k] === "done").length;
  const anyRunning = cvRunning || coverRunning || liveReading || liveDrafting;
  const allReady = counted.every((k) => steps[k] === "done");

  // Once the form's questions are known, write the cover letter if they ask for one.
  useEffect(() => {
    if (!wantCover || !(liveFields || kit.answers.fields.length)) return;
    if (coverNeed === "required" || coverNeed === "optional") {
      if (!kit.cover.ready && !coverRunning) runCover();
      setWantCover(false);
    } else if (coverNeed === "none") setWantCover(false);
  }, [wantCover, coverNeed, liveFields, kit.answers.fields.length]);

  // Debounced save of offline edits back into the report's answers snapshot.
  useEffect(() => {
    if (!dirty.current || liveFields) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      const state: SnapshotState = kit.answers.state && kit.answers.state !== "submitted" ? kit.answers.state : kit.answers.state ?? "draft";
      const ok = await postSnapshot(kit, state, toSnapshotFields(draft));
      setSaving(false);
      if (ok) {
        dirty.current = false;
        setSavedAt(Date.now());
      } else toast({ message: "Couldn't save your edits to the report. They stay here; try again in a moment.", tone: "error" });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, kit, liveFields, toast]);

  const onAnswer = useCallback(
    (key: string, value: string) => {
      if (liveFields) {
        apply.setAnswer(key, value); // provider autosaves to the report
        return;
      }
      dirty.current = true;
      setDraft((prev) => prev.map((f) => (f.key === key ? { ...f, value, source: "user" } : f)));
    },
    [apply, liveFields],
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const guardCli = (): boolean => {
    if (hasCli()) return true;
    setCli(false);
    toast({ message: "Pick a CLI in Config first. Workers run on your machine with it.", tone: "error" });
    return false;
  };

  const runCv = () => {
    if (!guardCli()) return;
    startJob({ title: `CV PDF · ${kit.app.company}`, subtitle: "tailored for this role", kind: "pdf", input: n, page: `/apply?n=${n}` });
  };

  function runCover() {
    if (!guardCli()) return;
    startJob({ title: `Cover letter · ${kit.app.company}`, subtitle: kit.app.role, kind: "cover", input: n, page: `/apply?n=${n}` });
  }

  const draftAnswers = async (force = false) => {
    if (!formUrl) return;
    if (!guardCli()) return;
    if (apply.trackerNum && apply.trackerNum !== n && !["idle", "error", "done", "ready"].includes(apply.status)) {
      toast({ message: "Another application form is still being read. Wait for it to finish, then try again.", tone: "error" });
      return;
    }
    dirty.current = false;
    setOpen("answers");
    await apply.open(formUrl, { prefill: true, forcePrefill: force, company: kit.app.company, trackerNum: n });
  };

  const prepareAll = () => {
    if (!guardCli()) return;
    let started = 0;
    if (steps.cv === "todo") {
      runCv();
      started++;
    }
    if (steps.cover === "todo" && (coverNeed === "required" || coverNeed === "optional")) {
      runCover();
      started++;
    } else if (steps.cover === "todo" && coverNeed === "unknown") setWantCover(true);
    if (steps.answers === "todo") {
      void draftAnswers();
      started++;
    }
    toast({ message: started ? `Preparing ${started} step${started > 1 ? "s" : ""} in parallel. You can leave this page; workers keep running.` : "Everything is already prepared.", tone: "neutral" });
  };

  const openApplication = () => {
    if (!formUrl) return;
    window.open(formUrl, "_blank", "noopener,noreferrer");
    rememberOpened(n);
    setOpened(true);
  };

  const prefillBrowser = async () => {
    if (!formUrl) return;
    rememberOpened(n);
    setOpened(true);
    const ok = await apply.prefillInBrowser(formUrl, { company: kit.app.company, trackerNum: n });
    if (!ok) toast({ message: apply.error || "Couldn't open the form in the browser. Use Open application instead.", tone: "error" });
  };

  // Cover letter text for preview / copy.
  const loadCover = useCallback(async () => {
    const res = await fetch(`/api/drafts?n=${encodeURIComponent(n)}&kind=cover`).catch(() => null);
    if (!res?.ok) return null;
    const data = (await res.json()) as { content?: string };
    setCoverText(data.content ?? "");
    return data.content ?? "";
  }, [n]);
  useEffect(() => {
    if (kit.cover.ready) void loadCover();
  }, [kit.cover.ready, kit.cover.updatedAt, loadCover]);

  const downloadCover = () => {
    if (!coverText) return;
    const url = URL.createObjectURL(new Blob([plainText(coverText)], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${kit.app.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const coverFieldInForm = fields.find((f) => isCoverField(f.label) && f.type !== "file");

  // ── Render ─────────────────────────────────────────────────────────────────
  const liveLine = liveReading
    ? apply.status === "driving"
      ? `AI is navigating to the form${apply.driveSteps.length ? ` · step ${apply.driveSteps.length}` : ""}`
      : "Opening the real form on your machine and reading every question…"
    : liveDrafting
      ? apply.prefillLog.at(-1)?.replace(/^\+[\d.]+s\s+/, "") || "Drafting answers from your CV and profile…"
      : "";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="co-kit-hero co-kit-in" aria-labelledby="kit-title">
        <div className="flex items-start gap-3">
          <CompanyLogo name={kit.app.company} size={44} className="mt-0.5 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <span className="tabular-nums">#{n}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{kit.app.company}</span>
              {host(formUrl) && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{host(formUrl)}</span>
                </>
              )}
            </div>
            <h2 id="kit-title" className="mt-0.5 font-display text-xl leading-tight text-[var(--md-sys-color-on-surface)] sm:text-2xl">
              {kit.app.role}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={kit.app.score >= 4 ? "good" : kit.app.score >= 3.5 ? "warn" : "bad"}>{kit.app.score.toFixed(1)}/5</Badge>
              <Badge tone={applied ? "good" : "muted"}>{status}</Badge>
            </div>
          </div>
        </div>

        {applied && kit.submissionRecorded ? (
          <div className="mt-4"><Link href={`/pipeline/${n}`} className="md3-action-btn md3-action-btn--filled">View application record →</Link></div>
        ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[10rem] flex-1">
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <span>{applied ? "Applied" : allReady ? "Ready to apply" : anyRunning ? "Preparing…" : "Kit"}</span>
              <span className="tabular-nums">
                {doneCount}/{counted.length} ready
              </span>
            </div>
            <div className="co-kit-meter" role="progressbar" aria-valuemin={0} aria-valuemax={counted.length} aria-valuenow={doneCount} aria-label="Apply kit readiness">
              <span style={{ width: `${(doneCount / Math.max(1, counted.length)) * 100}%` }} />
            </div>
          </div>
          {!applied && (
            allReady ? (
              <Md3ActionButton variant="filled" icon="open_in_new" onClick={openApplication} disabled={!formUrl}>
                Open application
              </Md3ActionButton>
            ) : (
              <Md3ActionButton variant="filled" icon={anyRunning ? undefined : "bolt"} loading={anyRunning} onClick={prepareAll} cost="spend" aria-keyshortcuts="Shift+P">
                {anyRunning ? "Preparing…" : "Prepare everything"}
              </Md3ActionButton>
            )
          )}
        </div>
        )}
        {kit.app.score > 0 && kit.app.score < 4 && !applied && (
          <p className="md3-alert md3-alert--warning mt-3 text-sm">
            <MaterialSymbol name="trending_down" size={18} className="shrink-0" />
            <span>This role scored {kit.app.score.toFixed(1)}/5, below the 4.0 bar. Apply only with a specific reason; marking it Applied will ask for one.</span>
          </p>
        )}
        {!cli && !applied && (
          <p className="md3-alert md3-alert--warning mt-3 text-sm">
            <MaterialSymbol name="terminal" size={18} className="shrink-0" />
            <span>
              No CLI picked yet. <Link href="/config" className="font-medium underline">Choose one in Settings</Link> so the CV, answers and cover letter can be prepared.
            </span>
          </p>
        )}
        {!formUrl && (
          <p className="md3-alert md3-alert--warning mt-3 text-sm">
            <MaterialSymbol name="link_off" size={18} className="shrink-0" />
            <span>
              This report has no application URL. Add a <code>**URL:**</code> line to the report, or use <Link href="/apply?view=form" className="font-medium underline">Fill any application form</Link>.
            </span>
          </p>
        )}
      </section>


      {/* Steps */}
      <div id="prepare">
      <ol className="co-kit-card co-kit-in" aria-label="Apply kit steps">
        {/* 1. CV */}
        <Step index={1} state={steps.cv} title="Tailored CV" icon="description"
          detail={
            cvRunning ? lastStep(cvJob)
            : kit.cv.ready ? <span className="break-all">{kit.cv.file}{kit.cv.date ? ` · ${kit.cv.date}` : ""}</span>
            : cvJob?.status === "error" ? <span className="text-[var(--md-sys-color-error)]">{cvJob.error || "The last run failed."}</span>
            : "A PDF rewritten for this job's keywords. Facts come from cv.md only."
          }
        >
          {kit.cv.ready && kit.cv.href ? (
            <>
              <a className="md3-action-btn md3-action-btn--outlined" href={kit.cv.href} target="_blank" rel="noreferrer">
                <MaterialSymbol name="visibility" size={18} /> <span className="md3-action-btn__label">Preview</span>
              </a>
              <a className="md3-action-btn md3-action-btn--outlined" href={kit.cv.href} download={kit.cv.file}>
                <MaterialSymbol name="download" size={18} /> <span className="md3-action-btn__label">Download</span>
              </a>
              <Md3ActionButton variant="text" icon="refresh" onClick={runCv} disabled={cvRunning} cost="spend">
                Regenerate
              </Md3ActionButton>
            </>
          ) : cvRunning ? (
            cvJob && <Link href={`/jobs/${cvJob.id}`} className="md3-action-btn md3-action-btn--text"><MaterialSymbol name="terminal" size={18} /> <span className="md3-action-btn__label">Watch</span></Link>
          ) : (
            <Md3ActionButton icon="picture_as_pdf" onClick={runCv} cost="spend">
              {cvJob?.status === "error" ? "Retry" : "Generate CV"}
            </Md3ActionButton>
          )}
        </Step>

        {/* 2. Answers */}
        <Step index={2} state={steps.answers} title="Form answers" icon="edit_note"
          detail={
            liveReading || liveDrafting ? <span aria-live="polite">{liveLine}</span>
            : live && apply.status === "error" ? <span className="text-[var(--md-sys-color-error)]">{apply.error}</span>
            : answersStats.total > 0 ? (
              <span>
                {answersStats.answered}/{answersStats.total} answered
                {answersStats.flagged > 0 && <span className="font-medium text-[var(--md-sys-color-tertiary)]"> · {answersStats.flagged} need you</span>}
                {kit.answers.state && <span className="text-[var(--md-sys-color-outline)]"> · saved as {kit.answers.state}</span>}
              </span>
            )
            : formUrl ? "Reads the real application form on your machine, then drafts every answer from your CV."
            : "Needs the posting's application URL."
          }
        >
          {(liveReading || liveDrafting) ? (
            <Link href="/apply?view=form" className="md3-action-btn md3-action-btn--text"><MaterialSymbol name="visibility" size={18} /> <span className="md3-action-btn__label">Watch live</span></Link>
          ) : answersStats.total > 0 ? (
            <>
              <Md3ActionButton icon={open === "answers" ? "expand_less" : "rate_review"} onClick={() => setOpen(open === "answers" ? null : "answers")} aria-expanded={open === "answers"} aria-controls="kit-answers">
                {open === "answers" ? "Hide answers" : "Review answers"}
              </Md3ActionButton>
              <Md3ActionButton variant="text" icon="refresh" onClick={() => void draftAnswers(true)} disabled={!formUrl} cost="spend">
                Redraft
              </Md3ActionButton>
            </>
          ) : (
            <Md3ActionButton icon="auto_awesome" onClick={() => void draftAnswers()} disabled={!formUrl} cost="spend">
              Draft answers
            </Md3ActionButton>
          )}
          {(open === "answers" || liveDrafting) && answersStats.total > 0 && (
            <div id="kit-answers" className="co-kit-panel co-kit-in w-full">
              <ApplyAnswers fields={fields} profile={kit.profile} onChange={onAnswer} saving={saving || (live && apply.snapshotSaving)} savedAt={savedAt ?? (live && apply.snapshotState ? 1 : null)} busy={liveDrafting || liveFilling} />
            </div>
          )}
          {liveReading && (
            <div className="co-kit-panel w-full space-y-3 p-4" aria-hidden>
              {[60, 85, 45, 70].map((w, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="co-kit-skel h-3" style={{ width: `${w}%` }} />
                  <div className="co-kit-skel h-9 w-full" />
                </div>
              ))}
            </div>
          )}
        </Step>

        {/* 3. Cover letter */}
        <Step index={3} state={steps.cover} title="Cover letter" icon="mail"
          detail={
            coverRunning ? lastStep(coverJob)
            : kit.cover.ready ? (coverNeed === "none" ? "Written. This form doesn't ask for one, keep it for email." : `Written${coverFieldInForm ? `, paste it into “${coverFieldInForm.label}”` : ""}.`)
            : coverNeed === "required" ? "The form requires one."
            : coverNeed === "optional" ? "The form has an optional cover letter field."
            : coverNeed === "none" ? "Not needed: the form doesn't ask for one."
            : wantCover ? "Will be written if the form asks for one."
            : "Checked once the form's questions are read."
          }
        >
          {kit.cover.ready ? (
            <>
              <Md3ActionButton icon={open === "cover" ? "expand_less" : "visibility"} onClick={() => setOpen(open === "cover" ? null : "cover")} aria-expanded={open === "cover"}>
                {open === "cover" ? "Hide" : "Preview"}
              </Md3ActionButton>
              <Md3ActionButton variant="outlined" icon="content_copy" onClick={async () => copy(plainText(coverText ?? (await loadCover()) ?? ""), "Cover letter copied")}>
                Copy
              </Md3ActionButton>
              <Md3ActionButton variant="outlined" icon="download" onClick={downloadCover} disabled={!coverText}>
                Download
              </Md3ActionButton>
              <Md3ActionButton variant="text" icon="refresh" onClick={runCover} disabled={coverRunning} cost="spend">
                Regenerate
              </Md3ActionButton>
            </>
          ) : coverRunning ? (
            coverJob && <Link href={`/jobs/${coverJob.id}`} className="md3-action-btn md3-action-btn--text"><MaterialSymbol name="terminal" size={18} /> <span className="md3-action-btn__label">Watch</span></Link>
          ) : (
            <Md3ActionButton variant={coverNeed === "required" ? "outlined" : "text"} icon="edit" onClick={runCover} cost="spend">
              {coverNeed === "none" || coverNeed === "unknown" ? "Write one anyway" : "Write cover letter"}
            </Md3ActionButton>
          )}
          {open === "cover" && kit.cover.ready && (
            <div className="co-kit-panel co-kit-in w-full">
              {coverText === null ? <div className="space-y-2 p-4">{[90, 100, 80, 95].map((w, i) => <div key={i} className="co-kit-skel h-3" style={{ width: `${w}%` }} />)}</div> : <div className="co-kit-prose">{plainText(coverText)}</div>}
            </div>
          )}
        </Step>

        {/* 4. Open */}
        <Step index={4} state={steps.open} title="Open application" icon="open_in_new"
          detail={
            liveFilling ? "Filling the real form in a browser window on your machine…"
            : live && apply.status === "done" ? "Filled and in front of you. Review every field, then click Submit yourself."
            : formUrl ? <span>Opens <span className="break-all">{host(formUrl)}</span> in a new tab. You review and submit there. Nothing is ever submitted for you.</span>
            : "No application URL on the report."
          }
        >
          <Md3ActionButton variant={allReady && !applied ? "filled" : "outlined"} icon="open_in_new" onClick={openApplication} disabled={!formUrl}>
            Open application
          </Md3ActionButton>
          <Md3ActionButton
            variant="outlined"
            icon="magic_button"
            onClick={() => void prefillBrowser()}
            disabled={!formUrl || answersStats.answered === 0 || liveFilling || liveReading || liveDrafting}
            loading={liveFilling}
            title={answersStats.answered === 0 ? "Draft the answers first" : "Opens the form in a Chrome window, fills your reviewed answers and attaches the CV. It stops before Submit."}
          >
            {liveFilling ? "Filling…" : "Prefill in browser"}
          </Md3ActionButton>
        </Step>

        <Step index={5} state={steps.applied} title={kit.submissionRecorded ? "Application recorded" : "Record your submission"} icon="task_alt"
          detail={applied ? "Open Track to review the submission and communication history." : "After you submit, record where, when, how, and which CV you used."}
        >
          <div id="submit-record" className="w-full scroll-mt-6">
            {applied && kit.submissionRecorded ? <Link href={`/pipeline/${n}`} className="md3-action-btn md3-action-btn--outlined">View application record →</Link>
              : <ActivityComposer n={n} url={formUrl} cvFile={kit.cv.file} score={kit.app.score} submissionOnly onSaved={({ status: recordedStatus }) => { if (recordedStatus) setStatus(recordedStatus); void refresh(); const snapshotFields = toSnapshotFields(fields); if (snapshotFields.length) void postSnapshot(kit, "submitted", snapshotFields); }} />}
          </div>
        </Step>
      </ol>
      </div>

      <RoleEmailPanel n={n} company={kit.app.company} role={kit.app.role} />

      <p className="flex items-start gap-1.5 px-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
        <MaterialSymbol name="verified_user" size={14} className="mt-px shrink-0 text-[var(--md-sys-color-tertiary)]" />
        career-ops never submits an application. It prepares the kit; you review it and click Submit on the employer&apos;s site.
      </p>
      <KitShortcuts onPrepare={() => !applied && !anyRunning && !allReady && prepareAll()} onOpen={() => formUrl && openApplication()} />
    </div>
  );
}

function editable(fields: SnapshotField[]): EditableField[] {
  return fields.map((f, i) => ({ ...f, key: f.id ? `${f.id}#${i}` : `field-${i}` }));
}

function KitShortcuts({ onPrepare, onOpen }: { onPrepare: () => void; onOpen: () => void }) {
  const ref = useRef({ onPrepare, onOpen });
  ref.current = { onPrepare, onOpen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && e.key === "P") ref.current.onPrepare();
      if (e.shiftKey && e.key === "O") ref.current.onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <p className="hidden px-1 text-[11px] text-[var(--md-sys-color-outline)] sm:block">
      Shortcuts: <kbd className="font-mono">Shift P</kbd> prepare everything · <kbd className="font-mono">Shift O</kbd> open the application
    </p>
  );
}

function Step({
  index,
  state,
  title,
  icon,
  detail,
  children,
}: {
  index: number;
  state: StepState;
  title: string;
  icon: string;
  detail: React.ReactNode;
  children?: React.ReactNode;
}) {
  const stateLabel = { done: "Done", running: "In progress", todo: "To do", blocked: "Blocked", skipped: "Not needed" }[state];
  return (
    <li className="co-kit-step" aria-label={`${title}: ${stateLabel}`}>
      <span className="co-kit-dot" data-state={state} aria-hidden>
        {state === "done" ? (
          <MaterialSymbol name="check" size={18} />
        ) : state === "running" ? (
          <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
        ) : state === "skipped" ? (
          <MaterialSymbol name="remove" size={16} />
        ) : state === "blocked" ? (
          <MaterialSymbol name="block" size={16} />
        ) : (
          <MaterialSymbol name={icon} size={18} />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-[15px] font-semibold text-[var(--md-sys-color-on-surface)]">
            <span className="sr-only">Step {index}: </span>
            {title}
          </h3>
          <span className={cn("text-xs", state === "done" ? "text-[var(--md-sys-color-primary)]" : "text-[var(--md-sys-color-outline)]")}>{stateLabel}</span>
        </div>
        <div className="mt-0.5 text-sm text-[var(--md-sys-color-on-surface-variant)]">{detail}</div>
        {children && <div className="co-kit-actions">{children}</div>}
      </div>
    </li>
  );
}
