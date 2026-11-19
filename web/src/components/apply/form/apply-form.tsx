"use client";
import { useApply } from "@/components/apply/apply-provider";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useState } from "react";
import { DrivePanel, ApplyIssues, PhaseRail, RotatingStatus, ProcessingHero, FieldSkeleton, FieldRow } from "./form-parts";

const STYLE = `
@keyframes co-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.co-rise{animation:co-rise .55s cubic-bezier(.22,1,.36,1) both}
@keyframes co-flash{0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 0%, transparent)}22%{box-shadow:0 0 0 3px color-mix(in srgb, var(--md-sys-color-primary) 38%, transparent)}100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--md-sys-color-primary) 0%, transparent)}}
.co-flash{animation:co-flash 1.15s ease both;border-radius:.6rem}
@keyframes co-shim{0%{background-position:-200% 0}100%{background-position:200% 0}}
.co-skel{background:linear-gradient(90deg, color-mix(in srgb,var(--md-sys-color-on-surface) 5%, transparent) 25%, color-mix(in srgb,var(--md-sys-color-on-surface) 12%, transparent) 37%, color-mix(in srgb,var(--md-sys-color-on-surface) 5%, transparent) 63%);background-size:200% 100%;animation:co-shim 1.6s linear infinite;border-radius:.5rem}
@keyframes co-orb{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.35);opacity:.9}}
.co-orb{animation:co-orb 2.4s ease-in-out infinite}
@keyframes co-spin{to{transform:rotate(360deg)}}
.co-ring{animation:co-spin 3s linear infinite}
@media (prefers-reduced-motion: reduce){.co-rise,.co-flash,.co-skel,.co-orb,.co-ring{animation:none}}
`;

export function ApplyView() {
  const a = useApply();
  const [input, setInput] = useState("");

  if (a.status === "idle" || a.status === "error") {
    return (
      <div>
        <div className="flex w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-full)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] py-1.5 pl-4 pr-1.5 transition focus-within:border-[var(--md-sys-color-primary)]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && a.open(input.trim())}
            placeholder="Paste an application form URL (Ashby, Lever, Greenhouse…)"
            className="min-w-0 flex-1 bg-transparent py-1.5 md-body-medium text-[var(--md-sys-color-on-surface)] outline-none placeholder:text-[var(--md-sys-color-outline)]"
          />
          <button onClick={() => a.open(input.trim())} className="md3-btn-filled shrink-0 py-2">
            Read form
          </button>
        </div>
        {a.error && (
          <div className="md3-alert md3-alert--warning mt-4 flex-col items-stretch">
            <div className="flex items-start gap-2.5">
              <MaterialSymbol name="warning" size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm">{a.error}</p>
                {a.url && /^https?:\/\//.test(a.url) && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--md-sys-color-primary)] hover:underline"
                  >
                    Open the form directly <MaterialSymbol name="open_in_new" size={12} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const opening = a.status === "opening";
  const driving = a.status === "driving";
  const prefilling = a.status === "prefilling";
  const filling = a.status === "filling";
  const done = a.status === "done";
  const busy = opening || driving;
  const phase = busy ? 0 : prefilling ? 1 : 2;

  return (
    <div className="w-full">
      <style>{STYLE}</style>

      <PhaseRail phase={phase} />

      {!busy && (
        <div className="co-rise mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-[var(--md-sys-color-on-surface)] drop-shadow-sm">{a.title || "Application"}</h2>
          <span className="flex shrink-0 items-center gap-1">
            {a.trackerNum && (
              <Link href={`/apply?n=${a.trackerNum}`} className="md3-action-btn md3-action-btn--text inline-flex items-center gap-1 text-xs">
                <MaterialSymbol name="inventory_2" size={14} /> kit #{a.trackerNum}
              </Link>
            )}
            <button
              onClick={a.reset}
              className="md3-action-btn md3-action-btn--text inline-flex items-center gap-1 text-xs"
            >
              <MaterialSymbol name="refresh" size={14} /> new
            </button>
          </span>
        </div>
      )}

      {opening && (
        <>
          <ProcessingHero title="Reading your form…" subtitle="Opening the real application on your machine and reading every field." />
          <FieldSkeleton />
        </>
      )}

      {driving && <DrivePanel steps={a.driveSteps} />}

      {a.error && (
        <p className="co-rise md3-alert md3-alert--warning mb-3">
          <MaterialSymbol name="warning" size={18} className="mt-0.5 shrink-0" /> {a.error}
        </p>
      )}

      {!busy && (
        <div className="co-rise">
          <ApplyIssues issues={a.issues} />

          {prefilling && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--md-sys-color-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--md-sys-color-primary-container)_60%,transparent)] px-4 py-3 backdrop-blur-sm">
              <span className="relative grid size-8 shrink-0 place-items-center">
                <span className="co-orb absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--md-sys-color-primary)_40%,transparent)] blur-[6px]" />
                <MaterialSymbol name="auto_awesome" size={18} className="text-[var(--md-sys-color-primary)]" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--md-sys-color-on-surface)]">Drafting your answers…</div>
                <RotatingStatus />
              </div>
              <MaterialSymbol name="progress_activity" size={18} className="ml-auto shrink-0 animate-spin text-[var(--md-sys-color-primary)]" />
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Md3ActionButton onClick={a.prefill} disabled={prefilling || filling} loading={prefilling} icon={prefilling ? undefined : "auto_awesome"}>
              {prefilling ? "Drafting from your CV…" : "Pre-fill from my CV"}
            </Md3ActionButton>
          </div>

          {(prefilling || a.prefillLog.length > 0) && (
            <Md3Collapse
              className="mb-4"
              title={
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">
                  <MaterialSymbol name="terminal" size={14} /> Pre-fill diagnostics
                  {prefilling && <MaterialSymbol name="progress_activity" size={12} className="animate-spin text-[var(--md-sys-color-primary)]" />}
                  <span className="ml-auto text-[var(--md-sys-color-outline)]">{a.prefillLog.length} steps</span>
                </span>
              }
            >
              <ol className="space-y-0.5 font-mono text-[11px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
                {a.prefillLog.map((l, i) => (
                  <li key={i} className={l.startsWith("✗") ? "text-[var(--md-sys-color-on-tertiary-container)]" : ""}>
                    {l}
                  </li>
                ))}
                {prefilling && <li className="text-[var(--md-sys-color-outline)]">…</li>}
              </ol>
            </Md3Collapse>
          )}

          <div className="space-y-1 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-2 shadow-2xl shadow-black/10 backdrop-blur-md sm:p-3">
            {a.fields.map((f, i) => (
              <div key={f.id} className="co-rise rounded-xl px-3 py-2.5" style={{ animationDelay: `${Math.min(i * 45, 700)}ms` }}>
                <FieldRow
                  field={f}
                  value={a.answers[f.id] ?? ""}
                  needs={!!a.meta[f.id]?.needsConfirmation}
                  index={i}
                  drafting={prefilling}
                  onChange={(v) => a.setAnswer(f.id, v)}
                />
              </div>
            ))}
          </div>

          {(a.snapshotSaving || a.snapshotState) && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <MaterialSymbol name={a.snapshotSaving ? "sync" : "save"} size={14} className={a.snapshotSaving ? "animate-spin" : ""} />
              {a.snapshotSaving ? "Saving your answer snapshot…" : `Answer snapshot saved as ${a.snapshotState}.`}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Md3ActionButton variant="filled" onClick={a.fill} disabled={filling || prefilling} loading={filling} icon={filling ? undefined : "arrow_outward"}>
              {filling ? "Filling the real form…" : "Fill the real form & review"}
            </Md3ActionButton>
            <Md3ActionButton
              onClick={a.agentFill}
              disabled={filling || prefilling}
              icon="touch_app"
              title="Let the AI drive the real form and fill it field-by-field (for tricky / multi-step forms). It never submits."
            >
              Let the AI fill it
            </Md3ActionButton>
            <p className="inline-flex items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <MaterialSymbol name="verified_user" size={14} className="text-[var(--md-sys-color-tertiary)]" /> Never submits — you click Submit yourself.
            </p>
          </div>

          {filling && a.driveSteps.length > 0 && (
            <div className="mt-6">
              <DrivePanel steps={a.driveSteps} filling />
            </div>
          )}

          {(filling || done) && a.steps.length > 0 && (
            <div className="co-rise mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--md-sys-color-outline)]">Behind the scenes</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {a.steps.map((s, i) => (
                  <figure key={i} className="shrink-0">
                    {s.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumb} alt="" className="h-24 w-36 rounded-md border border-[var(--md-sys-color-outline-variant)] object-cover" />
                    ) : (
                      <div className="flex h-24 w-36 items-center justify-center rounded-md border border-dashed border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-outline)]">…</div>
                    )}
                    <figcaption className={cn("mt-1 w-36 truncate text-[10px]", s.ok ? "text-[var(--md-sys-color-outline)]" : "text-[var(--md-sys-color-error)]")}>{s.label || "field"}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          {done && (
            <div className="co-rise md3-alert md3-alert--success mt-4 flex-col items-stretch">
              <div className="flex items-start gap-2.5">
                <MaterialSymbol name="check_circle" size={20} className="mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">The real form is now in front, pre-filled.</span>{" "}
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">Review it and click Submit yourself — career-ops never submits for you.</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[color-mix(in_srgb,var(--md-sys-color-on-surface)_12%,transparent)] pt-3">
                <Md3ActionButton
                  variant="filled"
                  icon={a.snapshotState === "submitted" ? "verified" : "task_alt"}
                  onClick={a.confirmSubmitted}
                  disabled={a.snapshotSaving || a.snapshotState === "submitted"}
                  loading={a.snapshotSaving}
                >
                  {a.snapshotState === "submitted" ? "Submission recorded" : "I submitted this application"}
                </Md3ActionButton>
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {a.snapshotState === "submitted"
                    ? (a.trackerNum ? "Tracker marked Applied; answers and files saved." : "Answers saved. This form isn't linked to a tracker row, so update its status from the pipeline.")
                    : "Only confirm after the employer shows a success message."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
