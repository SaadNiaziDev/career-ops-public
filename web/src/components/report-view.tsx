"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Application } from "@/lib/career-ops";
import { scoreTone, scoreNum, legitimacyTone, parseReport } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { CompanyLogo } from "@/components/company-logo";
import { ScoreMethodology } from "@/components/score-methodology";
import { PipelineActions } from "@/components/pipeline/pipeline-actions";
import { DeleteFromTracker } from "@/components/delete-from-tracker";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { Md3Empty } from "@/components/ui/md3-empty";
import { cn } from "@/lib/cn";

type Section = { heading: string; letter: string | null; content: string };

type AlertTone = "success" | "warning" | "error" | "info";

const TONE_TEXT = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
  muted: "text-foreground",
} as const;

const SCORE_BAR = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  muted: "bg-[var(--md-sys-color-primary)]",
} as const;

const ALERT_CLASS: Record<AlertTone, string> = {
  success: "md3-alert--success",
  warning: "md3-alert--warning",
  error: "md3-alert--error",
  info: "md3-alert--info",
};

function cleanHeading(h: string): string {
  const stripped = h
    .replace(/^\s*(?:Block\s+)?[A-G][).:]\s*/i, "")
    .replace(/\s*\((?:lead|verdict)\)\s*$/i, "")
    .trim();
  return stripped || h.trim();
}

function isMachine(heading: string): boolean {
  return /machine summary|submitted|submit[-\s]?log/i.test(heading);
}

function isDraftExtra(heading: string): boolean {
  return /cover letter draft|extracted keywords/i.test(heading);
}

function extractMachineDecision(content: string): { decision: string | null; nextAction: string | null } {
  const decision = content.match(/final_decision:\s*"?([^"\n]+)"?/i)?.[1]?.trim() ?? null;
  const nextAction = content.match(/next_action:\s*"?([^"\n]+)"?/i)?.[1]?.trim() ?? null;
  return { decision, nextAction };
}

function extractTldr(content: string): string | null {
  const row = content.match(/\|\s*TL;DR\s*\|\s*([^|]+)\|/i);
  return row?.[1]?.trim() ?? null;
}

function buildFallbackRecommendation(
  sections: Section[],
  score: string | undefined,
  applies: boolean | null,
): string {
  const machine = sections.find((s) => isMachine(s.heading));
  if (machine) {
    const { decision, nextAction } = extractMachineDecision(machine.content);
    if (decision && nextAction) {
      return `**${decision}** — ${nextAction}`;
    }
    if (decision) return `**${decision}** at ${score ?? "this score"}.`;
  }
  const roleSummary = sections.find((s) => s.letter === "A");
  const tldr = roleSummary ? extractTldr(roleSummary.content) : null;
  if (tldr) return tldr;
  if (applies === true) return `Score **${score ?? "4.0+"}** — above the apply line. Review the match details, then generate a tailored CV.`;
  if (applies === false) return `Score **${score ?? "below 4.0"}** — below the apply line unless you have a specific reason to proceed.`;
  return "Open the full evaluation for match, comp, and legitimacy details.";
}

function formatScoreDisplay(score: string): string {
  const n = scoreNum(score);
  if (!Number.isNaN(n)) return n % 1 === 0 ? n.toFixed(1) : String(n);
  return score;
}

function preview(md: string, max = 72): string {
  const text = md
    .replace(/^#+\s.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > max ? sentence.slice(0, max).trimEnd() + "…" : sentence;
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

function SectionCollapse({ section, compact = false }: { section: Section; compact?: boolean }) {
  return (
    <Md3Collapse
      className="report-section-collapse"
      title={
        compact ? (
          <code className="text-xs">{cleanHeading(section.heading)}</code>
        ) : (
          <div className="flex min-w-0 items-start gap-2.5 pr-2">
            {section.letter && <span className="report-letter-badge">{section.letter}</span>}
            <div className="min-w-0">
              <strong className="text-sm">{cleanHeading(section.heading)}</strong>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{preview(section.content)}</p>
            </div>
          </div>
        )
      }
    >
      <article className={cn("report-prose-compact", compact && "opacity-80")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
      </article>
    </Md3Collapse>
  );
}

function ReportBody({
  body,
  score,
  applies,
  notes,
}: {
  body: string;
  score?: string;
  applies: boolean | null;
  notes?: string;
}) {
  const { intro, sections } = splitSections(body);

  if (sections.length === 0) {
    return (
      <article className="report-prose-compact">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>
    );
  }

  const verdict = sections.find((s) => /verdict|\(lead\)/i.test(s.heading));
  const rest = sections.filter((s) => s !== verdict);
  const machine = rest.filter((s) => isMachine(s.heading));
  const drafts = rest.filter((s) => isDraftExtra(s.heading));
  const evidence = rest.filter((s) => !isMachine(s.heading) && !isDraftExtra(s.heading));

  const recommendationMd =
    verdict?.content ??
    (notes?.trim() ? notes.trim() : buildFallbackRecommendation(sections, score, applies));

  const alertTone: AlertTone = (() => {
    if (applies === true) return "success";
    if (applies === false) return "warning";
    const t = score ? scoreTone(score) : "muted";
    if (t === "good") return "success";
    if (t === "bad") return "error";
    if (t === "warn") return "warning";
    return "info";
  })();

  return (
    <div className="dossier-inset-stack">
      {intro && (
        <article className="report-prose-compact">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
        </article>
      )}

      <div
        className={cn(
          "md3-alert report-verdict-alert flex-col items-stretch border-none bg-[var(--md-sys-color-primary-container)]",
          ALERT_CLASS[alertTone],
        )}
      >
        <span className="md-title-medium text-[var(--md-sys-color-on-primary-container)]">Recommendation</span>
        <article className="report-prose-compact [&_p:last-child]:mb-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{recommendationMd}</ReactMarkdown>
        </article>
      </div>

      {evidence.length > 0 && (
        <Md3Collapse
          className="report-toplevel-collapse"
          title={
            <div className="flex items-center gap-2.5">
              <span className="report-section-icon">
                <MaterialSymbol name="manage_search" size={16} />
              </span>
              <span>
                <strong className="text-sm">Full evaluation</strong>{" "}
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  · {evidence.length} sections
                </span>
              </span>
            </div>
          }
        >
          <div className="-mx-1 space-y-2">
            {evidence.map((s) => (
              <SectionCollapse key={s.heading} section={s} />
            ))}
          </div>
        </Md3Collapse>
      )}

      {drafts.length > 0 && (
        <Md3Collapse
          className="report-toplevel-collapse"
          title={
            <div className="flex items-center gap-2.5">
              <span className="report-section-icon">
                <MaterialSymbol name="edit_note" size={16} />
              </span>
              <span>
                <strong className="text-sm">Drafts & keywords</strong>{" "}
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">· {drafts.length}</span>
              </span>
            </div>
          }
        >
          <div className="-mx-1 space-y-2">
            {drafts.map((s) => (
              <SectionCollapse key={s.heading} section={s} />
            ))}
          </div>
        </Md3Collapse>
      )}

      {machine.length > 0 && (
        <Md3Collapse
          className="report-toplevel-collapse"
          title={
            <div className="flex items-center gap-2.5">
              <span className="report-section-icon">
                <MaterialSymbol name="code" size={16} />
              </span>
              <strong className="text-sm">Technical details</strong>
            </div>
          }
        >
          <div className="-mx-1 space-y-2">
            {machine.map((s) => (
              <SectionCollapse key={s.heading} section={s} compact />
            ))}
          </div>
        </Md3Collapse>
      )}
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
  const company = app?.company ?? meta?.title ?? `Report #${id}`;

  return (
    <PageShell width="wide" className="report-page">
      <DossierStack>
        <nav className="flex items-center gap-2 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
          <Link href="/pipeline" className="inline-flex items-center gap-1 hover:text-[var(--md-sys-color-primary)]">
            <MaterialSymbol name="arrow_back" size={18} />
            Pipeline
          </Link>
          <span>/</span>
          <span className="font-mono md-body-small">#{id}</span>
        </nav>

        <header className="flex flex-wrap items-start gap-5">
          <CompanyLogo name={company} size={64} className="rounded-[var(--md-sys-shape-corner-large-increased)]" />
          <div className="min-w-0 flex-1">
            <h1 className="md-display-small-emphasized truncate text-[var(--md-sys-color-on-surface)]">{company}</h1>
            {app?.role && (
              <p className="mt-1 truncate md-title-large text-[var(--md-sys-color-on-surface-variant)]">{app.role}</p>
            )}
          </div>
          {score && (
            <div className="shrink-0 text-right">
              <span className="block text-[64px] font-bold leading-none text-[var(--md-sys-color-primary)] tabular-nums">
                {formatScoreDisplay(score)}
              </span>
              <span className="md-body-small text-[var(--md-sys-color-outline)]">/5</span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0">
            {report ? (
              <ReportBody
                body={meta?.body ?? report}
                score={score}
                applies={applies}
                notes={app?.notes}
              />
            ) : (
              <Md3Empty
                icon="description"
                description={
                  <>
                    No report file found for #{id} in <code>reports/</code>.
                  </>
                }
              />
            )}
          </main>

          <aside className="dossier-stack lg:sticky lg:top-6">
            <Md3Card title={<span className="md-title-small">Act on it</span>} className="report-meta-card">
              <PipelineActions
                n={id}
                company={company}
                role={app?.role}
                url={url}
                pdfReady={(app?.pdf ?? "").includes("✅")}
                variant="rail"
              />
              {url && url.startsWith("http") && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="md3-btn-outlined mt-2 flex w-full"
                >
                  <MaterialSymbol name="open_in_new" size={18} />
                  View posting
                </a>
              )}
            </Md3Card>

            <Md3Card title={<span className="md-title-small">Decision</span>} className="report-meta-card">
              {score ? (
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Fit score</span>
                    <strong className={cn("tabular-nums", TONE_TEXT[tone])}>{formatScoreDisplay(score)}</strong>
                  </div>
                  {!Number.isNaN(n) && (
                    <>
                      <div className="report-score-track relative">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-highest)]">
                          <div
                            className={cn("h-full rounded-full transition-[width]", SCORE_BAR[tone])}
                            style={{ width: `${Math.min(Math.max(n / 5, 0), 1) * 100}%` }}
                          />
                        </div>
                        <div className="report-apply-line" style={{ left: "80%" }} aria-hidden />
                      </div>
                      <div className="relative mt-1 h-3 text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                        <span className="absolute left-0">1.0</span>
                        <span className="absolute" style={{ left: "80%", transform: "translateX(-50%)" }}>
                          4.0 apply
                        </span>
                        <span className="absolute right-0">5.0</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">No score on record.</p>
              )}

              <div className="mt-1">
                {meta?.legitimacy && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Legitimacy</span>
                    <span className={cn("report-glance-value", TONE_TEXT[legitimacyTone(meta.legitimacy)])}>
                      {meta.legitimacy}
                    </span>
                  </div>
                )}
                {archetype && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Role type</span>
                    <span className="report-glance-value" title={archetype}>
                      {archetype}
                    </span>
                  </div>
                )}
                {date && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Evaluated</span>
                    <span className="report-glance-value">{date}</span>
                  </div>
                )}
                {app?.status && (
                  <div className="report-glance-row">
                    <span className="report-glance-label">Status</span>
                    <StatusSelect n={id} current={app.status} />
                  </div>
                )}
              </div>

              {app && canDelete && (
                <div className="mt-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
                  <DeleteFromTracker n={id} />
                </div>
              )}
            </Md3Card>

            <ScoreMethodology />
          </aside>
        </div>
      </DossierStack>
    </PageShell>
  );
}
