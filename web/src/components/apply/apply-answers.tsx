"use client";

import { useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { Badge } from "@/components/ui/badge";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { cn } from "@/lib/cn";
import { SENSITIVE_LABEL, copyAllText, needsInput, profileSuggestion, sensitiveKind, type ProfileFacts } from "@/lib/apply/kit";
import type { SnapshotField } from "@/lib/apply/snapshot";
import { useCopy } from "./use-copy";

export type EditableField = SnapshotField & { key: string; options?: string[]; required?: boolean };

const SOURCE_LABEL: Record<SnapshotField["source"], string> = { ai: "AI draft", profile: "Profile", user: "You", form: "From form" };

/**
 * Every question from the real form with its drafted answer: editable inline,
 * copy per field and "copy all", and a flag on the answers only the user can
 * give (salary, work authorization, start date…), with the profile.yml value as
 * a one-tap suggestion when one exists.
 */
export function ApplyAnswers({
  fields,
  profile,
  onChange,
  saving,
  savedAt,
  busy,
}: {
  fields: EditableField[];
  profile: ProfileFacts;
  onChange: (key: string, value: string) => void;
  saving: boolean;
  savedAt: number | null;
  busy?: boolean;
}) {
  const copy = useCopy();
  const [filter, setFilterState] = useState<"all" | "flagged" | "empty">("all");
  // Freeze which rows a filter shows when it is picked, so a row doesn't vanish
  // from "Empty" the moment the user starts typing into it.
  const [pinned, setPinned] = useState<Set<string> | null>(null);
  const visible = useMemo(() => fields.filter((f) => f.type !== "file"), [fields]);
  const files = useMemo(() => fields.filter((f) => f.type === "file"), [fields]);
  const flagged = visible.filter(needsInput);
  const empty = visible.filter((f) => !f.value.trim());
  const setFilter = (next: "all" | "flagged" | "empty") => {
    setFilterState(next);
    setPinned(next === "all" ? null : new Set((next === "flagged" ? flagged : empty).map((f) => f.key)));
  };
  const shown = pinned ? visible.filter((f) => pinned.has(f.key)) : visible;

  return (
    <div className="co-kit-answers">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] px-3 py-2.5 sm:px-4">
        <div role="tablist" aria-label="Filter answers" className="flex min-w-0 flex-wrap gap-1.5">
          {([
            ["all", `All ${visible.length}`],
            ["flagged", `Needs you ${flagged.length}`],
            ["empty", `Empty ${empty.length}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "co-kit-chip",
                filter === value && "co-kit-chip--active",
                value === "flagged" && flagged.length > 0 && filter !== value && "co-kit-chip--warn",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-on-surface-variant)]" aria-live="polite">
          {saving ? (
            <>
              <MaterialSymbol name="progress_activity" size={14} className="animate-spin" /> Saving
            </>
          ) : savedAt ? (
            <>
              <MaterialSymbol name="cloud_done" size={14} /> Saved to report
            </>
          ) : null}
        </span>
        <Md3ActionButton variant="text" icon="content_copy" onClick={() => copy(copyAllText(fields), "All answers copied")} disabled={!visible.some((f) => f.value.trim())}>
          Copy all
        </Md3ActionButton>
      </div>

      {files.length > 0 && (
        <div className="flex items-start gap-2 border-b border-[var(--md-sys-color-outline-variant)] px-3 py-2.5 text-xs text-[var(--md-sys-color-on-surface-variant)] sm:px-4">
          <MaterialSymbol name="attach_file" size={16} className="mt-px shrink-0" />
          <span className="min-w-0">
            {files.map((f) => f.label).join(", ")}: attach your tailored CV {files.length > 1 ? "and the other files" : ""} on the real form. &ldquo;Prefill in browser&rdquo; attaches the CV for you.
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {filter === "flagged" ? "Nothing needs your call. Nice." : filter === "empty" ? "Every question has an answer." : "No questions yet."}
        </p>
      ) : (
        <ol className="divide-y divide-[var(--md-sys-color-outline-variant)]">
          {shown.map((f) => (
            <AnswerRow key={f.key} field={f} profile={profile} onChange={(v) => onChange(f.key, v)} onCopy={() => copy(f.value, "Answer copied")} busy={busy} />
          ))}
        </ol>
      )}
    </div>
  );
}

function AnswerRow({
  field: f,
  profile,
  onChange,
  onCopy,
  busy,
}: {
  field: EditableField;
  profile: ProfileFacts;
  onChange: (value: string) => void;
  onCopy: () => void;
  busy?: boolean;
}) {
  const kind = sensitiveKind(f.label);
  const flag = needsInput(f);
  const suggestion = profileSuggestion(kind, profile);
  const long = f.type === "textarea" || f.value.length > 90;
  const inputId = `kit-answer-${f.key}`;
  const control = cn(
    "w-full rounded-[var(--md-sys-shape-corner-medium)] border bg-[var(--md-sys-color-surface-container-low)] px-3 py-2 text-sm text-[var(--md-sys-color-on-surface)] outline-none transition placeholder:text-[var(--md-sys-color-outline)] focus:border-[var(--md-sys-color-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--md-sys-color-primary)_22%,transparent)]",
    flag ? "border-[color-mix(in_srgb,var(--md-sys-color-tertiary)_55%,transparent)]" : "border-[var(--md-sys-color-outline-variant)]",
  );
  const placeholder = flag ? "Your call. Type the answer you want to give." : "No answer yet";

  return (
    <li className={cn("px-3 py-3 sm:px-4", flag && "bg-[color-mix(in_srgb,var(--md-sys-color-tertiary-container)_22%,transparent)]")}>
      <div className="mb-1 flex items-start gap-2">
        <label htmlFor={inputId} className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--md-sys-color-on-surface)]">
          {f.label || "Untitled question"}
          {f.required && <span className="ml-0.5 text-[var(--md-sys-color-error)]" aria-label="required">*</span>}
        </label>
        {f.value.trim() && <span className="mt-0.5 shrink-0 text-[11px] text-[var(--md-sys-color-outline)]">{SOURCE_LABEL[f.source]}</span>}
        <button
          type="button"
          onClick={onCopy}
          disabled={!f.value.trim()}
          className="co-kit-icon-btn -mt-1.5"
          aria-label={`Copy answer to ${f.label}`}
          title="Copy answer"
        >
          <MaterialSymbol name="content_copy" size={16} />
        </button>
      </div>
      {((flag && kind) || (suggestion && suggestion !== f.value)) && (
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {flag && kind && <Badge tone="warn">Needs you · {SENSITIVE_LABEL[kind]}</Badge>}
        {suggestion && suggestion !== f.value && (
          <button type="button" className="co-kit-chip co-kit-chip--suggest" onClick={() => onChange(suggestion)} disabled={busy} title="Use the value from config/profile.yml">
            <MaterialSymbol name="person" size={14} /> Use profile: <span className="max-w-[14rem] truncate">{suggestion}</span>
          </button>
        )}
      </div>
      )}
      {f.options && f.options.length > 0 && (f.type === "select" || f.type === "radio") ? (
        <select id={inputId} value={f.value} onChange={(e) => onChange(e.target.value)} className={control} disabled={busy}>
          <option value="">Choose…</option>
          {f.value && !f.options.includes(f.value) && <option value={f.value}>{f.value}</option>}
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === "checkbox" && !f.value.trim().includes(" ") ? (
        <label className="inline-flex min-h-[40px] items-center gap-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
          <input
            id={inputId}
            type="checkbox"
            checked={/^(true|yes|on|checked)$/i.test(f.value.trim())}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
            className="size-4 accent-[var(--md-sys-color-primary)]"
            disabled={busy}
          />
          Yes
        </label>
      ) : long ? (
        <textarea
          id={inputId}
          rows={Math.min(8, Math.max(3, Math.ceil(f.value.length / 70)))}
          value={f.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(control, "resize-y leading-relaxed")}
          disabled={busy}
        />
      ) : (
        <input id={inputId} type="text" value={f.value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={control} disabled={busy} />
      )}
    </li>
  );
}
