"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { MaterialSymbol } from "@/components/material-symbol";
import { Badge } from "@/components/ui/badge";
import type { Job } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";
import { ageText, scoreLabel, scoreTone, type MatchItem } from "./matches-shared";
import styles from "./matches.module.css";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

const PILL: Record<"good" | "warn" | "bad" | "muted", string> = {
  good: "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]",
  warn: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
  bad: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
  muted: "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] ring-1 ring-inset ring-[var(--md-sys-color-outline-variant)]",
};

/** Score pill that stays legible on every surface in both themes. */
export function ScorePill({ item, large = false }: { item: MatchItem; large?: boolean }) {
  const label = scoreLabel(item);
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full font-semibold tabular-nums", large ? "min-h-[28px] px-3 text-sm" : "min-h-[22px] px-2 text-xs", PILL[label ? scoreTone(item) : "muted"])}>
      {label ?? "Unscored"}
    </span>
  );
}

export type MatchAction = "skip" | "restore" | "evaluate" | "report" | "write" | "outreach" | "apply" | "open";

const RUN_LABEL: Record<string, string> = {
  evaluate: "Evaluating",
  outreach: "Finding who's hiring",
  pdf: "Tailoring your CV",
};

function Meta({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <MaterialSymbol name={icon} size={16} className="shrink-0 text-[var(--md-sys-color-outline)]" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function ReasonList({ icon, tone, items }: { icon: string; tone: "good" | "warn" | "bad"; items: string[] }) {
  const color = tone === "good" ? "text-[var(--md-sys-color-primary)]" : tone === "bad" ? "text-[var(--md-sys-color-error)]" : "text-[var(--md-sys-color-tertiary)]";
  return (
    <ul className="space-y-2">
      {items.map((r, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[var(--md-sys-color-on-surface)]">
          <MaterialSymbol name={icon} size={18} filled className={cn("mt-0.5 shrink-0", color)} />
          <span className="min-w-0">{r}</span>
        </li>
      ))}
    </ul>
  );
}

function OutreachLine({ item }: { item: MatchItem }) {
  const o = item.outreach;
  if (!o) {
    return (
      <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
        No one contacted yet. Open Apply to prepare and review an email for this role.
      </p>
    );
  }
  const who = [o.contactName, o.contactTitle].filter(Boolean).join(", ");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {o.status === "ready" && <Badge tone="warn">Draft ready</Badge>}
      {o.status === "sent" && <Badge tone="good">Emailed</Badge>}
      {o.status === "replied" && <Badge tone="good">Replied</Badge>}
      <span className="min-w-0 text-[var(--md-sys-color-on-surface)]">{who || "Hiring contact"}</span>
      <Link href={item.n ? `/apply?n=${item.n}#email` : "/apply?view=email"} className="text-[var(--md-sys-color-primary)] hover:underline">
        {o.status === "ready" ? "Review and send" : "View email record"}
      </Link>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  hint,
  onClick,
  variant = "outlined",
  disabled,
  loading,
  title,
  compact = false,
}: {
  icon: string;
  label: string;
  hint: string;
  onClick: () => void;
  variant?: "filled" | "outlined" | "tonal";
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={cn(
          "flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium transition-transform active:scale-95 disabled:opacity-50",
          variant === "filled" ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]" : variant === "tonal" ? "text-[var(--md-sys-color-primary)]" : "text-[var(--md-sys-color-on-surface)]",
        )}
      >
        <MaterialSymbol name={loading ? "progress_activity" : icon} size={22} className={loading ? "animate-spin" : undefined} />
        <span className="max-w-full truncate">{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "filled" && "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm hover:shadow-md",
        variant === "tonal" && "border border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)]",
        variant === "outlined" && "border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]",
      )}
    >
      <MaterialSymbol name={loading ? "progress_activity" : icon} size={18} className={loading ? "animate-spin" : undefined} />
      <span>{label}</span>
      <span className="hidden opacity-70 lg:inline">
        <Kbd>{hint}</Kbd>
      </span>
    </button>
  );
}

export function MatchDetail({
  item,
  running,
  bucket,
  onAction,
  position,
  actions = true,
}: {
  item: MatchItem;
  running: Job[];
  bucket: "new" | "skipped" | "sent";
  onAction: (action: MatchAction) => void;
  position?: string;
  /** Phone layout renders actions in a fixed bottom bar instead. */
  actions?: boolean;
}) {
  const age = ageText(item);
  const evaluated = item.kind === "evaluated";
  const redFlags = [...item.hardStops, ...item.gaps].slice(0, 3);

  return (
    <article className={cn("flex flex-col gap-5", styles.enter)} aria-label={`${item.role} at ${item.company}`}>
      <header>
        <div className="flex items-start gap-3 sm:gap-4">
          <CompanyLogo name={item.company} size={52} className="mt-0.5 hidden sm:inline-flex" />
          <CompanyLogo name={item.company} size={40} className="mt-0.5 sm:hidden" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">{item.company}</p>
            <h2 className="md-title-large break-words text-[var(--md-sys-color-on-surface)]">{item.role}</h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <ScorePill item={item} large />
            {bucket !== "new" && item.status && <span className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">{item.status}</span>}
            {position && <span className="text-xs tabular-nums text-[var(--md-sys-color-outline)]">{position}</span>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--md-sys-color-on-surface-variant)] sm:pl-[68px]">
          {item.location && <Meta icon="location_on">{item.location}</Meta>}
          {item.comp && <Meta icon="payments">{item.comp}</Meta>}
          {age && <Meta icon="schedule">{age}</Meta>}
          {item.n && <Meta icon="tag">{item.n}</Meta>}
        </div>
      </header>

      {running.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-[var(--md-sys-color-primary-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-primary-container)]">
          <MaterialSymbol name="progress_activity" size={18} className="shrink-0 animate-spin" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{running.map((j) => RUN_LABEL[j.kind ?? ""] ?? j.title).join(" · ")}</span>
            {running[0]?.steps.at(-1)?.label && <span className="block truncate opacity-80">{running[0].steps.at(-1)?.label}</span>}
          </span>
          <Link href={`/jobs/${running[0].id}`} className="shrink-0 font-medium hover:underline">Watch</Link>
        </div>
      )}

      {evaluated ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">Why it fits</h3>
            {item.strengths.length ? <ReasonList icon="check_circle" tone="good" items={item.strengths} /> : <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">The report has no summary of strengths. Open it for the full reasoning.</p>}
          </section>
          <section className="rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">Watch out for</h3>
            {redFlags.length ? (
              <div className="space-y-2">
                {item.hardStops.length > 0 && <ReasonList icon="block" tone="bad" items={item.hardStops.slice(0, 3)} />}
                <ReasonList icon="error" tone="warn" items={item.gaps.slice(0, Math.max(0, 3 - item.hardStops.length))} />
              </div>
            ) : (
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">No red flags noted.</p>
            )}
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)] p-4">
          {typeof item.fit === "number" && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--md-sys-color-on-surface-variant)]">
                <span>Scanner fit</span>
                <span className="tabular-nums">{Math.round(item.fit)}/100</span>
              </div>
              <div className={styles.meter}>
                <div className={styles.meterFill} style={{ width: `${Math.max(4, Math.min(100, item.fit))}%` }} />
              </div>
            </div>
          )}
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Not evaluated yet. <span className="text-[var(--md-sys-color-on-surface)]">Evaluate</span> reads the posting against your CV and returns a score, the reasons it fits and any red flags.
          </p>
        </section>
      )}

      {(item.decision || item.nextAction || item.legitimacy) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm sm:gap-x-6">
          {item.decision && (<><dt className="text-[var(--md-sys-color-on-surface-variant)]">Verdict</dt><dd className="font-medium">{item.decision}</dd></>)}
          {item.legitimacy && (<><dt className="text-[var(--md-sys-color-on-surface-variant)]">Legitimacy</dt><dd>{item.legitimacy}</dd></>)}
          {item.nextAction && (<><dt className="text-[var(--md-sys-color-on-surface-variant)]">Next step</dt><dd>{item.nextAction}</dd></>)}
        </dl>
      )}

      {item.notes && bucket !== "new" && <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]"><span className="font-medium text-[var(--md-sys-color-on-surface)]">Note:</span> {item.notes}</p>}

      <section className="border-t border-[var(--md-sys-color-outline-variant)] pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">Hiring contact</h3>
        <OutreachLine item={item} />
      </section>

      {actions && <MatchActions item={item} running={running} bucket={bucket} onAction={onAction} />}
    </article>
  );
}

/** The action row. `compact` is the phone bottom bar: icon over label, equal widths. */
export function MatchActions({
  item,
  running,
  bucket,
  onAction,
  compact = false,
}: {
  item: MatchItem;
  running: Job[];
  bucket: "new" | "skipped" | "sent";
  onAction: (action: MatchAction) => void;
  compact?: boolean;
}) {
  const evaluating = running.some((j) => j.kind === "evaluate");
  const evaluated = item.kind === "evaluated";
  const lowScore = typeof item.score === "number" && item.score < 4;
  return (
    <div className={compact ? "grid auto-cols-fr grid-flow-col gap-1" : "flex flex-wrap gap-2"}>
        {bucket === "skipped" ? (
          <ActionButton compact={compact} icon="undo" label="Restore" hint="S" variant="tonal" onClick={() => onAction("restore")} />
        ) : bucket === "new" ? (
          <ActionButton compact={compact} icon="close" label="Skip" hint="S" onClick={() => onAction("skip")} />
        ) : null}
        {evaluated ? (
          <ActionButton compact={compact} icon="description" label="Report" hint="E" onClick={() => onAction("report")} />
        ) : (
          <ActionButton compact={compact} icon="query_stats" label={evaluating ? "Evaluating" : "Evaluate"} hint="E" variant={bucket === "new" ? "filled" : "outlined"} loading={evaluating} disabled={evaluating} onClick={() => onAction("evaluate")} />
        )}
        {evaluated && (
          <ActionButton
            compact={compact}
            icon="send"
            label="Apply"
            hint="A"
            variant={bucket === "new" ? "filled" : "outlined"}
            title={lowScore ? "Scored below 4.0. You'll be asked to confirm." : "Open the Apply kit to review before you submit"}
            onClick={() => onAction("apply")}
          />
        )}
        {item.url && <ActionButton compact={compact} icon="open_in_new" label="Posting" hint="O" onClick={() => onAction("open")} />}
    </div>
  );
}
