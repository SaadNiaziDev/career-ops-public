"use client";

// Building blocks of the form-filling view: progress, issues, the AI navigation trace and one field row.
import { Fragment, useEffect, useRef, useState } from "react";
import type { ApplyIssue, DriveStep } from "@/lib/apply/issue";
import type { ApplyField } from "@/lib/apply/extract";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { cn } from "@/lib/cn";

const DRIVE_VERB: Record<string, string> = { click: "Clicked", type: "Typed into", select: "Selected", scroll: "Scrolled", "parse-error": "Thinking…", stuck: "Stuck", reached_form: "Reached the form" };

export function DrivePanel({ steps, filling }: { steps: DriveStep[]; filling?: boolean }) {
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

export function ApplyIssues({ issues }: { issues: ApplyIssue[] }) {
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

export function PhaseRail({ phase }: { phase: number }) {
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

export const DRAFT_MSGS = [
  "Reading your CV…",
  "Reading the role and company…",
  "Matching your experience to each question…",
  "Writing every answer in your own voice…",
  "Flagging anything that needs your call…",
];

export function RotatingStatus() {
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

export function ProcessingHero({ title, subtitle }: { title: string; subtitle: string }) {
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

export function FieldSkeleton() {
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

export function FieldRow({
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

