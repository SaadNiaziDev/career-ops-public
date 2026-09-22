"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { scoreTone } from "@/lib/format";
import { intentKey, isActiveState, stateFromLegacyStatus, type RunState } from "@/lib/jobs/run-policy";

export type JobStep = { kind: "tool" | "status"; label: string; ts: number };
export type JobResult = { score: number | null; summary: string; tone: "good" | "warn" | "bad" | "muted" };

export type Job = {
  id: string;
  title: string;
  subtitle?: string;
  page?: string; // route the job was launched from / refers to
  input?: string; // the URL/posting it processed (links inbox rows to their worker)
  kind?: string;
  reportN?: string; // tracker/report number once the worker persists reports/{n}-*.md
  batchId?: string; // groups jobs fired together (e.g. "evaluate all Anthropic")
  context?: Record<string, unknown>;
  intentKey: string;
  state: RunState;
  status: "running" | "done" | "error";
  steps: JobStep[];
  text: string;
  result?: JobResult;
  error?: string;
  outputTruncated?: boolean;
  cost?: { tokens: number; usd?: number }; // per-run token cost (Claude result event) — local only
  startedAt: number;
  lastActivityAt: number;
  endedAt?: number;
  supersedesId?: string;
};

type StartOpts = {
  title: string;
  subtitle?: string;
  kind: string;
  input: string;
  page?: string;
  batchId?: string;
  context?: Record<string, unknown>;
};

type Ctx = {
  jobs: Job[];
  startJob: (opts: StartOpts) => string | null;
  cancelJob: (id: string) => void;
  removeJob: (id: string) => void;
  clearFinished: () => void;
};

const JobsContext = createContext<Ctx | null>(null);
export function useJobs() {
  const c = useContext(JobsContext);
  if (!c) throw new Error("useJobs must be used within <JobsProvider>");
  return c;
}

const CONFIG_KEY = "career-ops:config";
const JOBS_KEY = "career-ops:jobs";
const MAX_JOB_OUTPUT = 24_000;

function parseVerdict(text: string): JobResult {
  const m = text.match(/VERDICT:\s*([\d.]+)\s*\/\s*5\s*[—:|-]+\s*(.+)/i);
  if (m) {
    const score = parseFloat(m[1]);
    return { score, summary: m[2].trim().replace(/\s+/g, " ").slice(0, 90), tone: scoreTone(`${score}`) };
  }
  const s = text.match(/\b([0-5](?:\.\d)?)\s*\/\s*5\b/);
  if (s) {
    const score = parseFloat(s[1]);
    return { score, summary: "", tone: scoreTone(`${score}`) };
  }
  return { score: null, summary: "", tone: "muted" };
}

function latchReportNum(hay: string): string | undefined {
  const m =
    hay.match(/reports\/(\d+)/i) ||
    hay.match(/\[(\d+)\]\((?:\.\.\/)?reports\//i) ||
    hay.match(/batch\/tracker-additions\/(\d+)/i) ||
    hay.match(/\/pipeline\/(\d+)/);
  return m?.[1];
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const seq = useRef(0);
  const loaded = useRef(false);
  const jobsRef = useRef<Job[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const cancelled = useRef(new Set<string>());
  jobsRef.current = jobs;

  // restore history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(JOBS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) {
        // anything left "running" from a previous session is stale → mark interrupted
        const restored: Job[] = arr.map((j: Job) => {
          const state = j.state ?? stateFromLegacyStatus(j.status);
          if (!isActiveState(state)) return { ...j, state, intentKey: j.intentKey ?? intentKey(j.kind ?? "worker", j.input ?? ""), lastActivityAt: j.lastActivityAt ?? j.endedAt ?? j.startedAt };
          const now = Date.now();
          return { ...j, state: "interrupted", status: "error", error: "Interrupted when this page closed. Retry resumes with the same task identity.", endedAt: now, lastActivityAt: now, intentKey: j.intentKey ?? intentKey(j.kind ?? "worker", j.input ?? ""), steps: [...(j.steps || []), { kind: "status", label: "Interrupted by page reload", ts: now }] };
        });
        setJobs((current) => {
          const byId = new Map(current.map((j) => [j.id, j]));
          for (const job of restored) if (job?.id && !byId.has(job.id)) byId.set(job.id, job);
          return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 40);
        });
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);

  // Rehydrate the server-side worker ledger so a completed run survives a
  // refresh, cleared localStorage, or a second tab.
  useEffect(() => {
    fetch("/api/runs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!Array.isArray(data?.runs)) return;
        setJobs((current) => {
          const byId = new Map(current.map((j) => [j.id, j]));
          for (const run of data.runs as Job[]) {
            if (!run?.id || run.status === "running" || byId.has(run.id)) continue;
            byId.set(run.id, { ...run, state: run.state ?? stateFromLegacyStatus(run.status), intentKey: run.intentKey ?? intentKey(run.kind ?? "worker", run.input ?? ""), lastActivityAt: run.lastActivityAt ?? run.endedAt ?? run.startedAt });
          }
          return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 40);
        });
      })
      .catch(() => {});
  }, []);

  // persist
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 40)));
    } catch {
      /* quota */
    }
  }, [jobs]);

  const patch = useCallback((id: string, fn: (j: Job) => Job) => {
    setJobs((js) => js.map((j) => (j.id === id ? fn(j) : j)));
  }, []);

  const startJob = useCallback(
    (opts: StartOpts): string | null => {
      const taskIntent = intentKey(opts.kind, opts.input);
      const existing = jobsRef.current.find((job) => job.intentKey === taskIntent && isActiveState(job.state));
      if (existing) return existing.id;
      let cliId: string | null = null;
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        cliId = raw ? JSON.parse(raw).cliId || null : null;
      } catch {
        cliId = null;
      }
      const id = `job-${Date.now()}-${seq.current++}`;
      const startedAt = Date.now();
      const superseded = jobsRef.current.find((job) => job.intentKey === taskIntent && !isActiveState(job.state));
      const job: Job = {
        id,
        title: opts.title,
        subtitle: opts.subtitle,
        page: opts.page,
        input: opts.input,
        kind: opts.kind,
        batchId: opts.batchId,
        context: opts.context,
        intentKey: taskIntent,
        state: "queued",
        status: "running",
        steps: [{ kind: "status", label: "Queued", ts: startedAt }],
        text: "",
        startedAt,
        lastActivityAt: startedAt,
        supersedesId: superseded?.id,
      };
      jobsRef.current = [job, ...jobsRef.current];
      setJobs((js) => [job, ...js]);

      if (!cliId) {
        const endedAt = Date.now();
        const error = "No CLI configured — open Config";
        const steps = [
          { kind: "status" as const, label: "Queued", ts: job.startedAt },
          { kind: "status" as const, label: error, ts: endedAt },
        ];
        patch(id, (j) => ({ ...j, state: "needs-attention", status: "error", error, endedAt, lastActivityAt: endedAt, steps }));
        fetch("/api/runs/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...job, state: "needs-attention", status: "error", error, endedAt, steps, output: "" }),
        }).catch(() => {});
        return id;
      }

      (async () => {
        let text = "";
        let verdictLine = ""; // latched separately so the 8000-char tail can't drop it
        let reportN: string | undefined = /^\d+$/.test(opts.input.trim()) ? opts.input.trim() : latchReportNum(opts.page ?? "");
        let doneTokens = 0; // per-run token cost, forwarded on the done event (#6)
        let doneCostUsd: number | null = null;
        let outputTruncated = false;
        let finished = false;
        const steps: JobStep[] = [];
        const latchReport = (hay: string) => {
          const n = latchReportNum(hay);
          if (n) reportN = n;
        };
        const finish = (state: RunState, lastLabel?: string) => {
          if (finished) return;
          if (cancelled.current.has(id) && state !== "cancelled") return;
          finished = true;
          controllers.current.delete(id);
          const status = state === "completed" ? "done" as const : "error" as const;
          const result = status === "done" ? parseVerdict(verdictLine || text) : undefined;
          const cost = doneTokens > 0 ? { tokens: doneTokens, usd: doneCostUsd ?? undefined } : undefined;
          const error = status === "error" ? lastLabel || "Worker failed" : undefined;
          latchReport(`${verdictLine}\n${text}`);
          const endedAt = Date.now();
          const finalSteps = lastLabel ? [...steps, { kind: "status" as const, label: lastLabel, ts: endedAt }] : steps;
          patch(id, (j) => ({
            ...j,
            state,
            status,
            result,
            error,
            cost,
            reportN,
            outputTruncated,
            endedAt,
            lastActivityAt: endedAt,
            steps: lastLabel ? [...j.steps, { kind: "status", label: lastLabel, ts: endedAt }] : j.steps,
          }));
          // Persist both successful and failed runs so the worker log is a
          // truthful history, including the useful failure message.
          fetch("/api/runs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...job, state, status, error, reportN, endedAt, lastActivityAt: endedAt, result, cost, steps: finalSteps, output: text, outputTruncated }),
          }).catch(() => {});
          if (status === "done") {
            // Tell server-snapshot surfaces (Today, pipeline) to refetch — the
            // worker just wrote a real tracker row / report they don't yet see.
            if (typeof window !== "undefined" && ["evaluate", "pdf", "cover", "email", "contacto", "titles", "interview-prep", "interview-questions", "interview-plan", "interview-practice", "interview-debrief", "interview-redflag"].includes(opts.kind ?? "")) {
              window.dispatchEvent(new CustomEvent("co-job-done", { detail: { kind: opts.kind, input: opts.input } }));
            }
          }
        };

        try {
          const controller = new AbortController();
          controllers.current.set(id, controller);
          const res = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: opts.kind, input: opts.input, cliId, runId: id, context: opts.context }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            const e = await res.json().catch(() => ({}));
            finish("needs-attention", e.error || "Failed to start");
            return;
          }
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              try {
                const ev = JSON.parse(line);
                const activityAt = Date.now();
                if (ev.type === "tool") {
                  steps.push({ kind: "tool", label: ev.name, ts: activityAt });
                  patch(id, (j) => ({ ...j, state: "running", lastActivityAt: activityAt, steps: [...j.steps, { kind: "tool", label: ev.name, ts: activityAt }] }));
                } else if (ev.type === "status") {
                  steps.push({ kind: "status", label: ev.label, ts: activityAt });
                  patch(id, (j) => ({ ...j, state: "running", lastActivityAt: activityAt, steps: [...j.steps, { kind: "status", label: ev.label, ts: activityAt }] }));
                } else if (ev.type === "text") {
                  const full = text + ev.text;
                  const vm = full.match(/VERDICT:[^\n]*/i);
                  if (vm) verdictLine = vm[0];
                  latchReport(full);
                  outputTruncated = full.length > MAX_JOB_OUTPUT;
                  text = full.slice(-MAX_JOB_OUTPUT);
                  patch(id, (j) => ({ ...j, state: "running", text, reportN, outputTruncated, lastActivityAt: activityAt }));
                } else if (ev.type === "warning") {
                  const label = ev.msg || "Worker warning";
                  steps.push({ kind: "status", label, ts: activityAt });
                  patch(id, (j) => ({ ...j, lastActivityAt: activityAt, steps: [...j.steps, { kind: "status", label, ts: activityAt }] }));
                } else if (ev.type === "done") {
                  // finish happens on stream-close; capture the per-run cost it carries
                  if (typeof ev.tokens === "number") doneTokens = ev.tokens;
                  if (typeof ev.costUsd === "number") doneCostUsd = ev.costUsd;
                  if (typeof ev.reportN === "string" && ev.reportN.trim()) reportN = ev.reportN.trim();
                } else if (ev.type === "error") {
                  finish("needs-attention", ev.msg || "Worker needs attention");
                  return;
                } else if (ev.type === "cancelled") {
                  finish("cancelled", ev.msg || "Cancelled safely");
                  return;
                }
              } catch {
                /* skip */
              }
            }
          }
          finish("completed", "Completed");
        } catch {
          finish("needs-attention", "Connection interrupted. Retry safely when ready.");
        }
      })();

      return id;
    },
    [patch],
  );

  const cancelJob = useCallback((id: string) => {
    const job = jobsRef.current.find((item) => item.id === id);
    if (!job || !isActiveState(job.state)) return;
    const endedAt = Date.now();
    cancelled.current.add(id);
    patch(id, (item) => ({ ...item, state: "cancelled", status: "error", error: "Cancelled safely", endedAt, lastActivityAt: endedAt, steps: [...item.steps, { kind: "status", label: "Cancelled safely", ts: endedAt }] }));
    void fetch(`/api/run?id=${encodeURIComponent(id)}`, { method: "DELETE" }).finally(() => {
      controllers.current.get(id)?.abort();
      controllers.current.delete(id);
    });
    const steps = [...job.steps, { kind: "status" as const, label: "Cancelled safely", ts: endedAt }];
    void fetch("/api/runs/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...job, state: "cancelled", status: "error", error: "Cancelled safely", endedAt, lastActivityAt: endedAt, steps, output: job.text }) });
  }, [patch]);

  const removeJob = useCallback((id: string) => setJobs((js) => js.filter((j) => j.id !== id)), []);
  const clearFinished = useCallback(() => setJobs((js) => js.filter((j) => isActiveState(j.state))), []);

  return <JobsContext.Provider value={{ jobs, startJob, cancelJob, removeJob, clearFinished }}>{children}</JobsContext.Provider>;
}
