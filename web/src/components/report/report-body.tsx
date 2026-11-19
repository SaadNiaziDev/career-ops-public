"use client";

// The evaluation report body: sections as collapsible blocks, rendered from markdown.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { cn } from "@/lib/cn";
import { parseMachineSummary, scoreTone, stripMachineSummary } from "@/lib/format";
import { DimensionChart } from "./dimension-chart";
import { VerdictCard } from "./verdict-card";

export function cleanHeading(h: string): string {
  const stripped = h
    .replace(/^\s*(?:Block\s+)?[A-G][).:]\s*/i, "")
    .replace(/\s*\((?:lead|verdict)\)\s*$/i, "")
    .trim();
  return stripped || h.trim();
}

export function isMachine(heading: string): boolean {
  return /machine summary|submitted|submit[-\s]?log/i.test(heading);
}

export function isDraftExtra(heading: string): boolean {
  return /cover letter draft|extracted keywords/i.test(heading);
}

export function preview(md: string, max = 72): string {
  const text = md
    .replace(/^#+\s.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > max ? sentence.slice(0, max).trimEnd() + "…" : sentence;
}

export function SectionCollapse({ section, compact = false }: { section: Section; compact?: boolean }) {
  const content = section.heading === "Application Answers"
    ? section.content.replace(/```application-answers-json[\s\S]*?```/g, "").trim()
    : section.content;
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
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{preview(content)}</p>
            </div>
          </div>
        )
      }
    >
      <article className={cn("report-prose-compact", compact && "opacity-80")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </Md3Collapse>
  );
}

export function ReportBody({
  body,
  score,
  applies,
  notes,
  machineSummary,
  legitimacy,
  parsedIntro,
  parsedSections,
  warnings,
}: {
  body: string;
  score?: string;
  applies: boolean | null;
  notes?: string;
  machineSummary?: ReturnType<typeof parseMachineSummary>;
  legitimacy?: string | null;
  parsedIntro: string;
  parsedSections: Section[];
  warnings: string[];
}) {
  const proseBody = stripMachineSummary(body);
  const intro = parsedIntro;
  const sections = parsedSections.filter((section) => !isMachine(section.heading));
  const formatNotice = warnings.length > 0 ? (
    <div role="status" className="md3-alert md3-alert--warning">
      <div><strong>Report format notice</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
    </div>
  ) : null;

  if (sections.length === 0) {
    return (
      <div className="dossier-inset-stack">
        {formatNotice}
        {machineSummary && <VerdictCard summary={machineSummary} score={score} legitimacy={legitimacy} />}
        <article className="report-prose-compact"><ReactMarkdown remarkPlugins={[remarkGfm]}>{proseBody || body}</ReactMarkdown></article>
      </div>
    );
  }

  const verdict = sections.find((s) => /verdict|\(lead\)/i.test(s.heading));
  const rest = sections.filter((s) => s !== verdict);
  const machine = rest.filter((s) => isMachine(s.heading));
  const drafts = rest.filter((s) => isDraftExtra(s.heading));
  const evidence = rest.filter((s) => !isMachine(s.heading) && !isDraftExtra(s.heading));

  const recommendationMd =
    verdict?.content ??
    (notes?.trim() ? notes.trim() : buildFallbackRecommendation(sections, score, applies, machineSummary ?? null));

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
      {formatNotice}
      {machineSummary && <VerdictCard summary={machineSummary} score={score} legitimacy={legitimacy} />}
      <DimensionChart scores={machineSummary?.scores} globalScore={score} />

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

export type Section = { heading: string; letter: string | null; content: string };

export type AlertTone = "success" | "warning" | "error" | "info";

export const ALERT_CLASS: Record<AlertTone, string> = {
  success: "md3-alert--success",
  warning: "md3-alert--warning",
  error: "md3-alert--error",
  info: "md3-alert--info",
};

export function buildFallbackRecommendation(
  sections: Section[],
  score: string | undefined,
  applies: boolean | null,
  machineSummary: ReturnType<typeof parseMachineSummary>,
): string {
  const machine = sections.find((s) => isMachine(s.heading));
  if (machine || machineSummary) {
    const decision = machineSummary?.final_decision ?? null;
    const nextAction = machineSummary?.next_action ?? null;
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

export function extractTldr(content: string): string | null {
  const row = content.match(/\|\s*TL;DR\s*\|\s*([^|]+)\|/i);
  return row?.[1]?.trim() ?? null;
}
