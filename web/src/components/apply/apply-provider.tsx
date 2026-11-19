"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ApplyField } from "@/lib/apply/extract";
import type { ApplyIssue, DriveStep } from "@/lib/apply/issue";
import { restoredAnswers, snapshotFields, type AnswerSource, type ApplicationSnapshot, type SnapshotState } from "@/lib/apply/snapshot";
import { CONFIG_KEY } from "@/lib/cli-config";

export type FillStep = { fieldId: string; label: string; ok: boolean; thumb?: string };
type Meta = { needsConfirmation?: boolean };
type Status = "idle" | "opening" | "driving" | "prefilling" | "ready" | "filling" | "done" | "error";

type ApplyCtx = {
  status: Status;
  url: string;
  title: string;
  company: string;
  fields: ApplyField[];
  answers: Record<string, string>;
  meta: Record<string, Meta>;
  steps: FillStep[];
  shots: string[];
  prefillLog: string[];
  issues: ApplyIssue[];
  driveSteps: DriveStep[];
  error: string;
  snapshotState: SnapshotState | null;
  snapshotSaving: boolean;
  /** Tracker # this session belongs to (null for a pasted URL). */
  trackerNum: string | null;
  /** Opens the real form. Resolves true once fields are ready (and drafted when prefill is requested). */
  open: (url: string, opts?: { prefill?: boolean; forcePrefill?: boolean; company?: string; trackerNum?: string }) => Promise<boolean>;
  prefill: () => Promise<void>;
  setAnswer: (idOrLabel: string, value: string) => void;
  fill: () => Promise<void>;
  /** Open the form if needed (restoring saved answers), fill it in the visible browser and stop before submit. */
  prefillInBrowser: (url: string, opts: { company?: string; trackerNum: string }) => Promise<boolean>;
  agentFill: () => Promise<void>;
  confirmSubmitted: () => Promise<void>;
  reset: () => void;
};

const Ctx = createContext<ApplyCtx | null>(null);
export function useApply(): ApplyCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApply must be used within <ApplyProvider>");
  return c;
}

function cliId(): string | null {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}").cliId || null;
  } catch {
    return null;
  }
}

export function ApplyProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [fields, setFields] = useState<ApplyField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [steps, setSteps] = useState<FillStep[]>([]);
  const [shots, setShots] = useState<string[]>([]);
  const [prefillLog, setPrefillLog] = useState<string[]>([]);
  const [issues, setIssues] = useState<ApplyIssue[]>([]);
  const [driveSteps, setDriveSteps] = useState<DriveStep[]>([]);
  const [error, setError] = useState("");
  const [snapshotState, setSnapshotState] = useState<SnapshotState | null>(null);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [trackerNumState, setTrackerNumState] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const trackerNum = useRef<string | null>(null);
  const companyRef = useRef<string>("");
  const fieldsRef = useRef<ApplyField[]>([]);
  fieldsRef.current = fields;
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const sourcesRef = useRef<Record<string, AnswerSource>>({});
  const urlRef = useRef("");
  const answersDirty = useRef(false);
  const answerVersion = useRef(0);
  // When a session opens with {prefill:true}, auto-fire prefill once fields are
  // ready — driven by an effect (not a fragile setTimeout) so it can't race the
  // session response or a navigation.
  const pendingPrefill = useRef(false);

  const restoreSnapshot = useCallback(async (fs: ApplyField[]) => {
    if (!trackerNum.current) return false;
    const response = await fetch(`/api/apply/snapshot?tracker=${encodeURIComponent(trackerNum.current)}`);
    const data = await response.json() as { snapshot?: ApplicationSnapshot | null };
    if (!data.snapshot) return false;
    const restored = restoredAnswers(data.snapshot, fs);
    answersRef.current = restored.answers;
    setAnswers(restored.answers);
    sourcesRef.current = restored.sources;
    setSnapshotState(data.snapshot.state);
    pendingPrefill.current = false;
    return true;
  }, []);

  const saveSnapshot = useCallback(async (state: SnapshotState) => {
    if (!urlRef.current || fieldsRef.current.length === 0) return false;
    const savedVersion = answerVersion.current;
    setSnapshotSaving(true);
    try {
      const response = await fetch("/api/apply/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackerNum: trackerNum.current,
          sessionId: sessionId.current,
          vacancyUrl: urlRef.current,
          state,
          fields: snapshotFields(fieldsRef.current, answersRef.current, sourcesRef.current),
        }),
      });
      const data = await response.json() as { error?: string; trackerNum?: string };
      if (!response.ok) {
        if (response.status !== 404) setError(data.error || "Could not save the application snapshot.");
        return false;
      }
      if (data.trackerNum) trackerNum.current = data.trackerNum;
      if (answerVersion.current === savedVersion) answersDirty.current = false;
      setSnapshotState(state);
      return true;
    } catch {
      setError("Could not save the application snapshot.");
      return false;
    } finally {
      setSnapshotSaving(false);
    }
  }, []);

  // Stream the agentic drive (the AI reaching the form live) and finalize the
  // session when it succeeds → fields ready → auto-prefill fires.
  const drive = useCallback(async (id: string): Promise<boolean> => {
    setDriveSteps([]);
    try {
      const r = await fetch("/api/apply/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, cliId: cliId(), goal: "reach" }) });
      if (!r.body) {
        setError("The agent couldn't start.");
        setStatus("error");
        return false;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      let reached = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { t?: string; message?: string; fields?: ApplyField[]; title?: string; issues?: ApplyIssue[] } & DriveStep;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.t === "step") setDriveSteps((p) => [...p, ev as DriveStep]);
          else if (ev.t === "done") {
            finished = true;
            fieldsRef.current = ev.fields ?? [];
            setFields(ev.fields ?? []);
            await restoreSnapshot(ev.fields ?? []);
            if (ev.title) setTitle(ev.title);
            setIssues(ev.issues ?? []);
            reached = true;
            setStatus("ready"); // → the ready-effect auto-prefills if pending
          } else if (ev.t === "error") {
            finished = true;
            setError(ev.message || "The agent couldn't reach a fillable form.");
            setStatus("error");
          }
        }
      }
      if (!finished) {
        setError("The agent stopped before reaching a form.");
        setStatus("error");
      }
      return reached;
    } catch (e) {
      setError(`The agent couldn't reach the form: ${e instanceof Error ? e.message : "stream error"}.`);
      setStatus("error");
      return false;
    }
  }, [restoreSnapshot]);

  const open = useCallback(async (u: string, opts?: { prefill?: boolean; forcePrefill?: boolean; company?: string; trackerNum?: string }): Promise<boolean> => {
    if (sessionId.current) {
      // Free the previous off-screen tab before opening another form.
      const prev = sessionId.current;
      sessionId.current = null;
      void fetch("/api/apply/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: prev }), keepalive: true }).catch(() => {});
    }
    setStatus("opening");
    setError("");
    setSnapshotState(null);
    answersDirty.current = false;
    answerVersion.current = 0;
    setFields([]);
    setAnswers({});
    setMeta({});
    setSteps([]);
    setShots([]);
    setIssues([]);
    setDriveSteps([]);
    setUrl(u);
    urlRef.current = u;
    fieldsRef.current = [];
    answersRef.current = {};
    sourcesRef.current = {};
    trackerNum.current = opts?.trackerNum ?? null;
    setTrackerNumState(opts?.trackerNum ?? null);
    setCompany(opts?.company ?? "");
    companyRef.current = opts?.company ?? "";
    pendingPrefill.current = false;
    try {
      const r = await fetch("/api/apply/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u, cliId: cliId() }) });
      const d = await r.json();
      if (d.error) {
        setError(d.error);
        setStatus("error");
        return false;
      }
      sessionId.current = d.id;
      setTitle(d.title);
      setShots(d.shots ?? []);
      pendingPrefill.current = !!opts?.prefill;
      if (d.needsDrive) {
        // The form is behind navigation → the agent drives to reach it, streamed.
        setStatus("driving");
        const reached = await drive(d.id);
        if (reached && opts?.forcePrefill) pendingPrefill.current = true;
        return reached;
      }
      fieldsRef.current = d.fields;
      setFields(d.fields);
      await restoreSnapshot(d.fields);
      // "Regenerate answers" re-drafts even when a saved snapshot was restored.
      if (opts?.forcePrefill) pendingPrefill.current = true;
      setIssues(d.issues ?? []);
      setStatus("ready");
      return true;
    } catch {
      setError("Could not open the form.");
      setStatus("error");
      return false;
    }
  }, [drive, restoreSnapshot]);

  const prefill = useCallback(async () => {
    if (!sessionId.current) return;
    if (!cliId()) {
      setError("Configure a CLI in Config first, then pre-fill from your CV.");
      return;
    }
    setStatus("prefilling");
    setError("");
    setPrefillLog([]);
    const applyAnswers = (raw: Record<string, { value?: string; needs_confirmation?: boolean }>) => {
      const a: Record<string, string> = {};
      const m: Record<string, Meta> = {};
      for (const [id, v] of Object.entries(raw)) {
        a[id] = v?.value ?? "";
        m[id] = { needsConfirmation: !!v?.needs_confirmation };
        sourcesRef.current[id] = "ai"; // every drafted value came from the AI planner
      }
      answersDirty.current = true;
      answerVersion.current += 1;
      answersRef.current = a;
      setAnswers(a);
      setMeta(m);
    };
    try {
      const r = await fetch("/api/apply/prefill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sessionId.current, cliId: cliId() }) });
      if (!r.ok) {
        const error = await r.json().catch(() => ({})) as { error?: string };
        setError(error.error ? `Couldn't pre-fill: ${error.error}` : `Couldn't pre-fill (HTTP ${r.status}).`);
        setStatus("ready");
        return;
      }
      if (!r.body) {
        setError("Couldn't pre-fill — no response stream.");
        setStatus("ready");
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let got = false;
      let sawError = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { t?: string; m?: string; el?: number; raw?: string; answers?: Record<string, { value?: string; needs_confirmation?: boolean }>; count?: number; truncated?: boolean };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.t === "log") {
            setPrefillLog((p) => [...p, `+${((ev.el ?? 0) / 1000).toFixed(1)}s  ${ev.m}`]);
          } else if (ev.t === "done") {
            got = true;
            applyAnswers(ev.answers ?? {});
            if ((ev.count ?? 0) === 0) setError("The planner returned 0 answers — see the diagnostics log below.");
            else if (ev.truncated) setError("The planner was cut off — some fields were recovered, others may be blank. See diagnostics.");
          } else if (ev.t === "error") {
            sawError = true;
            setError(ev.m ? `Couldn't pre-fill: ${ev.m}` : "Couldn't pre-fill from your CV.");
            setPrefillLog((p) => [...p, `✗ ${ev.m ?? "error"}${ev.raw ? ` — raw tail: ${ev.raw.slice(0, 160)}` : ""}`]);
          }
        }
      }
      if (!got && !sawError) setError("Pre-fill ended without answers — see the diagnostics log below.");
      setStatus("ready");
    } catch (e) {
      setError(`Couldn't pre-fill from your CV: ${e instanceof Error ? e.message : "stream error"}. See diagnostics.`);
      setStatus("ready");
    }
  }, []);

  // Auto-prefill exactly once after the fields are ready.
  useEffect(() => {
    if (status === "ready" && pendingPrefill.current) {
      pendingPrefill.current = false;
      void prefill();
    }
  }, [status, prefill]);

  const setAnswer = useCallback((idOrLabel: string, value: string) => {
    const fs = fieldsRef.current;
    const key = idOrLabel.toLowerCase();
    const f =
      fs.find((x) => x.id === idOrLabel) ||
      fs.find((x) => x.label.toLowerCase().includes(key)) ||
      fs.find((x) => key.includes(x.label.toLowerCase()) && x.label.length > 2);
    if (f) {
      sourcesRef.current[f.id] = "user";
      answersDirty.current = true;
      answerVersion.current += 1;
      answersRef.current = { ...answersRef.current, [f.id]: value };
      setAnswers((prev) => ({ ...prev, [f.id]: value }));
    }
  }, []);

  useEffect(() => {
    if (!answersDirty.current || status !== "ready" || fields.length === 0 || Object.keys(answers).length === 0) return;
    const timer = window.setTimeout(() => void saveSnapshot("draft"), 700);
    return () => window.clearTimeout(timer);
  }, [answers, fields.length, saveSnapshot, status]);

  const fill = useCallback(async () => {
    if (!sessionId.current) return;
    setStatus("filling");
    setSteps([]);
    try {
      const r = await fetch("/api/apply/fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sessionId.current, answers: answersRef.current, fields: fieldsRef.current, handoff: true, company: companyRef.current, trackerNum: trackerNum.current }) });
      const d = await r.json();
      if (d.error) {
        setError(d.error);
        setStatus("error");
        return;
      }
      setSteps(d.steps ?? []);
      // merge the verify-after-fill warnings (required-empty / mismatch / validation)
      if (Array.isArray(d.issues) && d.issues.length) {
        setIssues((prev) => {
          const seen = new Set(prev.map((i: ApplyIssue) => i.message));
          return [...prev, ...(d.issues as ApplyIssue[]).filter((i) => !seen.has(i.message))];
        });
      }
      if (d.navigated) setError("Heads up: the form's page changed during fill — review it carefully before submitting (career-ops never submits for you).");
      setStatus("done");
      await saveSnapshot("filled");
      // ESCALATION ("si no va, full agente"): if deterministic fill clearly
      // didn't land (most fields failed / mismatched), let the agent fill it.
      const okCount = (d.steps ?? []).filter((s: FillStep) => s.ok).length;
      const total = (d.steps ?? []).length;
      const mismatch = (d.issues ?? []).some((i: ApplyIssue) => i.code === "fill-mismatch");
      if (cliId() && total > 0 && (okCount === 0 || (mismatch && okCount < total / 2))) {
        await agentFillRef.current();
      }
    } catch {
      setError("Fill failed.");
      setStatus("error");
    }
  }, [saveSnapshot]);

  // FULL-AGENT FILL — the agent fills the real form turn-by-turn from the verified
  // answers, streamed (drive panel), never submits, then hands off. Used as the
  // escalation when deterministic fill fails, or on demand.
  const agentFill = useCallback(async () => {
    if (!sessionId.current) return;
    const fs = fieldsRef.current;
    const a = answersRef.current;
    const ans = fs.filter((f) => f.type !== "file" && (a[f.id] || "").trim()).map((f) => ({ label: f.label || f.id, value: a[f.id] }));
    setDriveSteps([]);
    setError("");
    setStatus("filling");
    try {
      const r = await fetch("/api/apply/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sessionId.current, cliId: cliId(), goal: "full", answers: ans }) });
      if (!r.body) {
        setError("The agent couldn't start filling.");
        setStatus("error");
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { t?: string; message?: string; filled?: boolean } & DriveStep;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.t === "step") setDriveSteps((p) => [...p, ev as DriveStep]);
          else if (ev.t === "done") {
            setIssues((prev) => [...prev, { level: "info", code: "ai-filled", message: ev.filled ? "AI filled the form for you — review every answer on the real form, then submit it yourself." : "AI did its best but couldn't finish — check the real form before submitting." }]);
            setStatus("done");
            await saveSnapshot("filled");
          } else if (ev.t === "error") {
            setError(ev.message || "The agent couldn't fill the form.");
            setStatus("error");
          }
        }
      }
    } catch (e) {
      setError(`The agent couldn't fill the form: ${e instanceof Error ? e.message : "stream error"}.`);
      setStatus("error");
    }
  }, [saveSnapshot]);
  const agentFillRef = useRef(agentFill);
  agentFillRef.current = agentFill;

  // The user clicked "I submitted this application" → tracker status goes through
  // the canonical status API (confirm-gated, stage history), then the exact
  // answers are recorded in the report as "submitted".
  const confirmSubmitted = useCallback(async () => {
    const markApplied = async (n: string) => {
      setSnapshotSaving(true);
      const r = await fetch("/api/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, status: "Applied", confirmedSubmission: true }) }).catch(() => null);
      setSnapshotSaving(false);
      if (r?.ok) return true;
      const d = r ? await r.json().catch(() => ({})) as { error?: string } : {};
      setError(d.error ? `Answers saved, but the tracker wasn't updated: ${d.error} Mark it from the Apply kit.` : "Couldn't mark the tracker Applied. Open the Apply kit to retry.");
      return false;
    };
    let n = trackerNum.current;
    if (n && !(await markApplied(n))) return;
    const saved = await saveSnapshot("submitted");
    // A pasted URL that matched a tracker row: the snapshot write resolved its number.
    if (!n && saved && trackerNum.current) {
      n = trackerNum.current;
      setTrackerNumState(n);
      if (!(await markApplied(n))) return;
    }
    if (saved || n) setIssues((prev) => [...prev, { level: "info", code: "submission-recorded", message: n ? "Marked Applied. Your exact answers and document version are saved in the report." : "Submission recorded." }]);
  }, [saveSnapshot]);

  const prefillInBrowser = useCallback(async (u: string, opts: { company?: string; trackerNum: string }): Promise<boolean> => {
    const sameSession = !!sessionId.current && urlRef.current === u && trackerNum.current === opts.trackerNum && fieldsRef.current.length > 0;
    if (!sameSession) {
      const ok = await open(u, { company: opts.company, trackerNum: opts.trackerNum });
      if (!ok) return false;
    }
    companyRef.current = opts.company ?? companyRef.current;
    await fill();
    return true;
  }, [fill, open]);

  const reset = useCallback(() => {
    if (sessionId.current) {
      const id = sessionId.current;
      void fetch("/api/apply/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }), keepalive: true }).catch(() => {});
    }
    sessionId.current = null;
    trackerNum.current = null;
    setTrackerNumState(null);
    urlRef.current = "";
    fieldsRef.current = [];
    answersRef.current = {};
    sourcesRef.current = {};
    answersDirty.current = false;
    answerVersion.current = 0;
    companyRef.current = "";
    pendingPrefill.current = false;
    setStatus("idle");
    setUrl("");
    setTitle("");
    setCompany("");
    setFields([]);
    setAnswers({});
    setMeta({});
    setSteps([]);
    setShots([]);
    setPrefillLog([]);
    setIssues([]);
    setDriveSteps([]);
    setError("");
    setSnapshotState(null);
    setSnapshotSaving(false);
  }, []);

  const value = useMemo(
    () => ({ status, url, title, company, fields, answers, meta, steps, shots, prefillLog, issues, driveSteps, error, snapshotState, snapshotSaving, trackerNum: trackerNumState, open, prefill, setAnswer, fill, prefillInBrowser, agentFill, confirmSubmitted, reset }),
    [status, url, title, company, fields, answers, meta, steps, shots, prefillLog, issues, driveSteps, error, snapshotState, snapshotSaving, trackerNumState, open, prefill, setAnswer, fill, prefillInBrowser, agentFill, confirmSubmitted, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
