import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Application } from "@/lib/career-ops";
import { scoreTone, scoreNum, legitimacyTone, parseReport } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { CompanyLogo } from "@/components/company-logo";
import { ScoreMethodology } from "@/components/score-methodology";
import { PipelineActions } from "@/components/pipeline/pipeline-actions";
import { DeleteFromTracker } from "@/components/delete-from-tracker";
import { cn } from "@/lib/cn";

// The report as a DOSSIER SPREAD: a wide reading column for the report itself
// and a sticky decision rail on the right that answers "should I apply?" at a
// glance (score meter → verdict → facts → actions) and stays pinned while the
// user reads the evidence. Progressive disclosure is unchanged: verdict leads,
// A/B expanded, C–G collapsed, machine artifacts dimmed (native <details>,
// no client JS — this stays a server component).

type Section = { heading: string; letter: string | null; content: string };

const TONE_TEXT = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
  muted: "text-foreground",
} as const;

const TONE_BAR = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  muted: "bg-zinc-500",
} as const;

function cleanHeading(h: string): string {
  const stripped = h
    .replace(/^\s*(?:Block\s+)?[A-G][).:]\s*/i, "")
    .replace(/\s*\((?:lead|verdict)\)\s*$/i, "")
    .trim();
  return stripped || h.trim();
}

// Machine artifacts (collapsed because they're for devs, not the mainstream) vs
// human content C–G (collapsed only for length) — ux's "honest for devs" tier.
function isMachine(heading: string): boolean {
  return /machine summary|submitted|submit[-\s]?log/i.test(heading);
}

// A one-line teaser for a collapsed content section — drops the interaction cost
// of "what's in here?" without defeating the collapse.
function preview(md: string): string {
  const text = md
    .replace(/^#+\s.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 110 ? sentence.slice(0, 110).trimEnd() + "…" : sentence;
}

function splitSections(body: string): { intro: string; sections: Section[] } {
  const intro: string[] = [];
  const sections: Section[] = [];
  let cur: { heading: string; letter: string | null; lines: string[] } | null = null;
  for (const line of body.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      if (cur) sections.push({ heading: cur.heading, letter: cur.letter, content: cur.lines.join("\n").trim() });
      const heading = h[1].trim();
      const letter = heading.match(/^(?:Block\s+)?([A-G])[).:\s]/i)?.[1]?.toUpperCase() ?? null;
      cur = { heading, letter, lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (cur) sections.push({ heading: cur.heading, letter: cur.letter, content: cur.lines.join("\n").trim() });
  return { intro: intro.join("\n").trim(), sections };
}

function LetterChip({ letter, dim = false }: { letter: string; dim?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
        dim ? "bg-surface-hover text-faint" : "bg-brand-soft text-brand-text",
      )}
    >
      {letter}
    </span>
  );
}

function FactRow({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" | "muted" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-xs font-medium uppercase tracking-widest text-faint">{label}</span>
      <span className={cn("min-w-0 truncate text-right text-sm font-medium", tone ? TONE_TEXT[tone] : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

export function ReportView({
  id,
  app,
  report,
  canDelete = false,
}: {
  id: string;
  app: Application | null;
  report: string | null;
  /** kept in the props contract (the page passes it) but no longer surfaced —
   *  the raw .md filename is a dev artifact, not header content. */
  file?: string | null;
  canDelete?: boolean;
}) {
  const meta = report ? parseReport(report) : null;
  const field = (label: string) => meta?.fields.find((f) => f.label === label)?.value;
  const score = app?.score || field("Score");
  const date = app?.date || field("Date");
  const archetype = field("Archetype");
  const url = field("URL");

  const n = scoreNum(score ?? "");
  const tone = score ? scoreTone(score) : "muted";
  const applies = !Number.isNaN(n) ? n >= 4.0 : null;

  return (
    <div className="mx-auto max-w-[1560px] px-8 py-8">
      {/* ── Breadcrumb strip ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-sm">
        <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-brand">
          <ArrowLeft className="size-4" /> Pipeline
        </Link>
        <span className="text-faint">/</span>
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-faint">Report #{id}</span>
      </div>

      {/* ── Identity band ────────────────────────────────────────────── */}
      <header className="mt-6 flex items-center gap-5 border-b border-border pb-7">
        <CompanyLogo name={app?.company ?? meta?.title ?? `Report #${id}`} size={56} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-4xl tracking-tight text-landing">
            {app?.company ?? meta?.title ?? `Report #${id}`}
          </h1>
          {app?.role && <p className="mt-1.5 truncate text-base text-muted">{app.role}</p>}
        </div>
        {score && (
          <div className="ml-auto flex shrink-0 items-baseline gap-2 pl-6">
            <span className={cn("font-display text-5xl tracking-tight tabular-nums", TONE_TEXT[tone])}>{score}</span>
          </div>
        )}
      </header>

      {/* ── Spread: report (left) + sticky decision rail (right) ─────── */}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_360px] items-start gap-12">
        <main className="min-w-0">
          {report ? (
            <>
              {(() => {
                const { intro, sections } = splitSections(meta?.body ?? report);
                // Tolerant fallback: unrecognized layout → render the whole body,
                // so an old/odd report never loses content.
                if (sections.length === 0) {
                  return (
                    <article className="report-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{meta?.body ?? report}</ReactMarkdown>
                    </article>
                  );
                }
                // Only promote a real verdict — older cores wrote "## F) Verdict
                // (lead)", newer reports may use F for interview prep instead.
                const verdict = sections.find((s) => /verdict|\(lead\)/i.test(s.heading));
                const rest = sections.filter((s) => s !== verdict);
                const machine = rest.filter((s) => isMachine(s.heading));
                const mainSections = rest.filter((s) => !isMachine(s.heading));
                const anyAB = mainSections.some((s) => s.letter === "A" || s.letter === "B");
                return (
                  <>
                    {intro && (
                      <article className="report-prose mb-8">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
                      </article>
                    )}

                    {/* Verdict — THE answer, leading the reading column */}
                    {verdict && (
                      <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-brand-soft/40 p-7">
                        <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />
                        <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brand-text">
                          Verdict
                        </p>
                        <article className="report-prose text-[1.02rem] [&_p]:font-medium [&_p]:text-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{verdict.content}</ReactMarkdown>
                        </article>
                      </div>
                    )}

                    {/* A/B — the evidence, always expanded */}
                    {mainSections.map((s, i) => {
                      const expanded = s.letter === "A" || s.letter === "B" || (!anyAB && i === 0);
                      if (expanded) {
                        return (
                          <section key={s.heading} className="mt-12">
                            <header className="mb-4 flex items-center gap-3 border-b border-border pb-3">
                              {s.letter && <LetterChip letter={s.letter} />}
                              <h2 className="font-display text-2xl tracking-tight text-foreground">
                                {cleanHeading(s.heading)}
                              </h2>
                            </header>
                            <article className="report-prose">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                            </article>
                          </section>
                        );
                      }
                      return (
                        <details key={s.heading} className="group mt-4 overflow-hidden rounded-xl border border-border bg-surface/40 first-of-type:mt-12">
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-hover">
                            {s.letter && <LetterChip letter={s.letter} />}
                            <span className="shrink-0 text-sm font-semibold text-foreground">{cleanHeading(s.heading)}</span>
                            <span className="min-w-0 truncate text-xs text-faint">{preview(s.content)}</span>
                            <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="report-prose border-t border-border px-6 py-5">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                          </div>
                        </details>
                      );
                    })}

                    {/* Machine artifacts — present but clearly secondary */}
                    {machine.length > 0 && (
                      <>
                        <div className="mt-12 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-faint">
                          <span className="h-px flex-1 bg-border" />
                          Technical details · for developers
                          <span className="h-px flex-1 bg-border" />
                        </div>
                        {machine.map((s) => (
                          <details key={s.heading} className="group mt-3 overflow-hidden rounded-xl border border-border/60 bg-surface/20">
                            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 font-mono text-xs text-muted transition-colors hover:bg-surface-hover">
                              {cleanHeading(s.heading)}
                              <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="report-prose border-t border-border/60 px-6 py-5 opacity-80">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                            </div>
                          </details>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 p-6 text-sm text-muted">
              <FileText className="size-5 shrink-0 text-faint" />
              No report file found for #{id} in <code className="text-foreground">reports/</code>.
            </div>
          )}
        </main>

        {/* ── Decision rail — pinned while reading ─────────────────────── */}
        <aside className="sticky top-8 space-y-5">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/50">
            <div className="px-6 pb-5 pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Decision</p>
              {score ? (
                <>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <span className={cn("font-display text-6xl leading-none tracking-tight tabular-nums", TONE_TEXT[tone])}>
                      {scoreNum(score) || score}
                    </span>
                    {applies != null && (
                      <span
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                          applies ? "bg-emerald-500/15 text-emerald-500" : "bg-surface-hover text-muted",
                        )}
                      >
                        {applies ? "Apply" : "Below the line"}
                      </span>
                    )}
                  </div>
                  {/* 0–5 meter with the 4.0 apply line marked */}
                  {!Number.isNaN(n) && (
                    <div className="relative mt-5">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                        <div
                          className={cn("h-full rounded-full", TONE_BAR[tone])}
                          style={{ width: `${Math.min(Math.max(n / 5, 0), 1) * 100}%` }}
                        />
                      </div>
                      <div aria-hidden className="absolute inset-y-0 left-[80%] w-px bg-foreground/40" />
                      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
                        <span>1.0</span>
                        <span className="relative left-[5%]">4.0 — apply line</span>
                        <span>5.0</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">No score on record.</p>
              )}
            </div>
            <div className="divide-y divide-border/60 border-t border-border px-6 py-1.5">
              {meta?.legitimacy && (
                <FactRow label="Legitimacy" value={meta.legitimacy} tone={legitimacyTone(meta.legitimacy)} />
              )}
              {archetype && <FactRow label="Role type" value={archetype} />}
              {date && <FactRow label="Evaluated" value={date} />}
              {app?.status && (
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-widest text-faint">Status</span>
                  <StatusSelect n={id} current={app.status} />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/50 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Act on it</p>
            <div className="report-rail-actions mt-4">
              <PipelineActions
                n={id}
                company={app?.company ?? meta?.title ?? id}
                role={app?.role}
                url={url}
                pdfReady={(app?.pdf ?? "").includes("✅")}
              />
            </div>
            {url && url.startsWith("http") && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand"
              >
                View original posting <ExternalLink className="size-3.5" />
              </a>
            )}
            {app && canDelete && (
              <div className="mt-4 border-t border-border/60 pt-4">
                <DeleteFromTracker n={id} />
              </div>
            )}
          </div>

          <ScoreMethodology />
        </aside>
      </div>
    </div>
  );
}
