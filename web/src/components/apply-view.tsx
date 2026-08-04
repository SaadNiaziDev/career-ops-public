"use client";

import type { ApplyIssue, DriveStep } from "@/lib/apply/issue";
import { useApply } from "@/components/apply/apply-provider";
import type { ApplyField } from "@/lib/apply/extract";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { cn } from "@/lib/cn";
import { Fragment, useEffect, useRef, useState } from "react";

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
          <button
            onClick={a.reset}
            className="md3-action-btn md3-action-btn--text inline-flex items-center gap-1 text-xs"
          >
            <MaterialSymbol name="refresh" size={14} /> new
          </button>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DRIVE_VERB: Record<string, string> = { click: "Clicked", type: "Typed into", select: "Selected", scroll: "Scrolled", "parse-error": "Thinking…", stuck: "Stuck", reached_form: "Reached the form" };

function DrivePanel({ steps, filling }: { steps: DriveStep[]; filling?: boolean }) {
  const last = steps[steps.length - 1];
  return (
    <div className="co-rise">
      <div className="flex flex-col items-center gap-3 py-7 text-center">
        <span className="relative grid size-14 place-items-center">
          <span className="co-orb absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--md-sys-color-primary)_30%,transparent)] blur-lg" />
          <span className="co-ring absolute inset-0 rounded-full border-2 border-[color-mix(in_srgb,var(--md-sys-color-primary)_30%,transparent)] border-t-[var(--md-sys-color-primary)]" />
          <MaterialSymbol name="touch_app" size={24} className="text-[var(--md-sys-color-primary)]" />
        </span>
        <div className="font-display text-2xl text-[var(--md-sys-color-on-surface)]">{filling ? "AI is filling the form…" : "Reaching your form…"}</div>
        <p className="max-w-sm text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {filling
            ? "The AI is driving the real form field-by-field on your machine — it never submits; you review and submit."
            : "The AI is navigating the real application on your machine to reach the form — it never submits."}
        </p>
      </div>
      {last?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={last.thumb} alt="" className="w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] shadow-xl shadow-black/10" />
      ) : (
        <div className="co-skel h-56 w-full rounded-xl" />
      )}
      {steps.length > 0 && (
        <ol className="mt-3 space-y-1.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-3 backdrop-blur-sm">
          {steps.map((s, i) => (
            <li key={i} className={cn("flex items-center gap-2 text-xs", i === steps.length - 1 ? "text-[var(--md-sys-color-on-surface)]" : "text-[var(--md-sys-color-on-surface-variant)]")}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--md-sys-color-primary-container)] text-[10px] font-semibold text-[var(--md-sys-color-on-primary-container)]">{s.turn}</span>
              <span className="shrink-0 font-medium">{DRIVE_VERB[s.action] ?? s.action}</span>
              <span className="truncate text-[var(--md-sys-color-outline)]">{s.detail}</span>
              {s.note && <span className="shrink-0 text-[var(--md-sys-color-error)]">· {s.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ApplyIssues({ issues }: { issues: ApplyIssue[] }) {
  if (!issues.length) return null;
  const warns = issues.filter((i) => i.level === "warn" || i.level === "block");
  const infos = issues.filter((i) => i.level === "info");
  return (
    <div className="mb-4 space-y-2">
      {warns.length > 0 && (
        <div className="md3-alert md3-alert--warning flex-col items-stretch">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <MaterialSymbol name="warning" size={18} /> A few things to check
          </div>
          <ul className="space-y-1 text-xs">
            {warns.map((i, k) => (
              <li key={k} className="flex gap-1.5">
                <span className="mt-px">•</span> {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {infos.map((i, k) => (
        <div key={k} className="flex items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <MaterialSymbol name="info" size={14} className="shrink-0 text-[var(--md-sys-color-outline)]" /> {i.message}
        </div>
      ))}
    </div>
  );
}

function PhaseRail({ phase }: { phase: number }) {
  const steps = [
    { label: "Reading form", icon: "document_scanner" },
    { label: "Drafting answers", icon: "edit" },
    { label: "Review & submit", icon: "check_circle" },
  ] as const;
  return (
    <div className="mb-6 flex items-center gap-2.5">
      {steps.map((s, i) => {
        const state = i < phase ? "done" : i === phase ? "active" : "todo";
        return (
          <Fragment key={i}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "relative grid size-6 place-items-center rounded-full border transition-colors",
                  state === "done" && "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]",
                  state === "active" && "border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]",
                  state === "todo" && "border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-outline)]",
                )}
              >
                {state === "done" ? <MaterialSymbol name="check" size={14} /> : <MaterialSymbol name={s.icon} size={14} />}
                {state === "active" && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[color-mix(in_srgb,var(--md-sys-color-primary)_30%,transparent)]" />}
              </span>
              <span className={cn("hidden text-xs font-medium sm:inline", i <= phase ? "text-[var(--md-sys-color-on-surface)]" : "text-[var(--md-sys-color-outline)]")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="relative h-px flex-1 overflow-hidden rounded bg-[var(--md-sys-color-outline-variant)]">
                <span className={cn("absolute inset-y-0 left-0 bg-[var(--md-sys-color-primary)] transition-all duration-700", i < phase ? "w-full" : "w-0")} />
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

const DRAFT_MSGS = [
  "Reading your CV…",
  "Reading the role and company…",
  "Matching your experience to each question…",
  "Writing every answer in your own voice…",
  "Flagging anything that needs your call…",
];

function RotatingStatus() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % DRAFT_MSGS.length), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <div key={i} className="co-rise truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
      {DRAFT_MSGS[i]}
    </div>
  );
}

function ProcessingHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="co-rise flex flex-col items-center gap-3 py-14 text-center">
      <span className="relative grid size-16 place-items-center">
        <span className="co-orb absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--md-sys-color-primary)_30%,transparent)] blur-lg" />
        <span className="co-ring absolute inset-0 rounded-full border-2 border-[color-mix(in_srgb,var(--md-sys-color-primary)_30%,transparent)] border-t-[var(--md-sys-color-primary)]" />
        <MaterialSymbol name="auto_awesome" size={28} className="text-[var(--md-sys-color-primary)]" />
      </span>
      <div className="font-display text-3xl text-[var(--md-sys-color-on-surface)]">{title}</div>
      <p className="max-w-sm text-sm text-[var(--md-sys-color-on-surface-variant)]">{subtitle}</p>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="co-rise space-y-3 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-5 backdrop-blur-md" style={{ animationDelay: "120ms" }}>
      {[64, 80, 48, 72, 56].map((w, i) => (
        <div key={i} className="space-y-2">
          <div className="co-skel h-3" style={{ width: `${w}px` }} />
          <div className="co-skel h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function FieldRow({
  field: f,
  value,
  needs,
  index,
  drafting,
  onChange,
}: {
  field: ApplyField;
  value: string;
  needs: boolean;
  index: number;
  drafting: boolean;
  onChange: (v: string) => void;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!prev.current && value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2300);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  const base = cn(
    "w-full rounded-lg border bg-[var(--md-sys-color-surface-container-low)] px-3 py-2 text-sm outline-none transition focus:border-[color-mix(in_srgb,var(--md-sys-color-primary)_60%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--md-sys-color-primary)_20%,transparent)]",
    needs ? "border-[color-mix(in_srgb,var(--md-sys-color-tertiary)_50%,transparent)]" : "border-[var(--md-sys-color-outline-variant)]",
  );
  const writing = drafting && !value && f.type !== "file";
  return (
    <div className={flash ? "co-flash" : ""} style={flash ? { animationDelay: `${Math.min(index * 70, 900)}ms` } : undefined}>
      <label className="mb-1.5 flex items-center gap-1 text-sm font-medium">
        {f.label || <span className="text-[var(--md-sys-color-outline)]">Untitled field</span>}
        {f.required && <MaterialSymbol name="emergency" size={12} className="text-[var(--md-sys-color-primary)]" />}
        {needs && (
          <span className="ml-1 rounded bg-[var(--md-sys-color-tertiary-container)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--md-sys-color-on-tertiary-container)]">
            you confirm
          </span>
        )}
      </label>
      {writing ? (
        <div className={cn("co-skel", f.type === "textarea" ? "h-[68px]" : "h-9")} />
      ) : f.type === "textarea" ? (
        <textarea rows={3} maxLength={f.maxLength} value={value} onChange={(e) => onChange(e.target.value)} placeholder={needs ? "You fill this one." : "…"} className={cn(base, "resize-none")} />
      ) : (f.type === "select" || f.type === "radio") && f.options && f.options.length > 0 ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Choose…</option>
          {f.options.map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === "checkbox" ? (
        <label className="flex items-center gap-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
          <input type="checkbox" checked={value === "true" || value === "yes"} onChange={(e) => onChange(e.target.checked ? "true" : "")} className="size-4 accent-[var(--md-sys-color-primary)]" /> {f.label || "Yes"}
        </label>
      ) : f.type === "file" ? (
        /resume|résumé|\bcv\b|curriculum|currículum|lebenslauf/i.test(f.label || "") ? (
          <div className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--md-sys-color-tertiary)_40%,transparent)] bg-[var(--md-sys-color-tertiary-container)] px-3 py-2 text-sm text-[var(--md-sys-color-on-tertiary-container)]">
            <MaterialSymbol name="fact_check" size={18} className="shrink-0" /> Your tailored CV (PDF) will be attached automatically — you can swap it on the real form.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <MaterialSymbol name="attach_file" size={18} className="shrink-0" /> Attach this file yourself on the real form at the handoff.
          </div>
        )
      ) : (
        <input type={["email", "tel", "url", "number", "date"].includes(f.type) ? f.type : "text"} maxLength={f.maxLength} value={value} onChange={(e) => onChange(e.target.value)} placeholder={needs ? "You fill this one." : "…"} className={base} />
      )}
    </div>
  );
}
