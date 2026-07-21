import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Application } from "@/lib/career-ops";
import { Badge } from "@/components/ui/badge";
import { scoreTone, scoreNum, legitimacyTone, parseReport } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { CompanyLogo } from "@/components/company-logo";
import { ScoreMethodology } from "@/components/score-methodology";
import { PipelineActions } from "@/components/pipeline/pipeline-actions";
import { DeleteFromTracker } from "@/components/delete-from-tracker";

// Progressive disclosure of the report. The core writes prose blocks
// "## F) Verdict (lead)", "## A) Role Summary", "## B) Match with CV", then
// C–G + machine artifacts (Machine Summary YAML, Application Answers, submit
// log). A mainstream user deciding "should I apply?" needs the verdict + fit;
// the rest is depth-on-demand. We lead with the verdict as a callout, keep A/B
// expanded, collapse C–G as content, and drop machine artifacts to a dimmer
// "Technical" tier — and strip the bare "F)" author-letters from headings
// (native <details>, no client JS — this stays a server component).

type Section = { heading: string; letter: string | null; content: string };

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
  return sentence.length > 96 ? sentence.slice(0, 96).trimEnd() + "…" : sentence;
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      <header className="mt-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-faint">#{id}</p>
        <div className="mt-2 flex items-center gap-3">
          <CompanyLogo name={app?.company ?? meta?.title ?? `Report #${id}`} size={40} />
          <div className="flex-1">
            <h1 className="font-display text-3xl tracking-tight text-landing">
              {app?.company ?? meta?.title ?? `Report #${id}`}
            </h1>
            {app?.role && <p className="mt-0.5 text-sm text-muted">{app.role}</p>}
          </div>
        </div>

        {/* Summary stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {score && (
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-widest text-faint">Score</p>
              <p className="mt-1 font-display text-lg font-semibold">
                <span className={`text-${scoreTone(score) === "good" ? "emerald" : scoreTone(score) === "warn" ? "amber" : "red"}-600`}>
                  {score}
                </span>
              </p>
            </div>
          )}
          {(() => {
            const n = scoreNum(score ?? "");
            if (Number.isNaN(n)) return null;
            const recommendation = n >= 4.0 ? "Apply" : "Skip";
            const color = n >= 4.0 ? "emerald" : "slate";
            return (
              <div className="rounded-lg border border-border bg-surface/50 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-widest text-faint">Verdict</p>
                <p className={`mt-1 font-semibold text-${color}-600`}>{recommendation}</p>
              </div>
            );
          })()}
          {meta?.legitimacy && (
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-widest text-faint">Legitimacy</p>
              <p className="mt-1 text-sm font-semibold">{meta.legitimacy}</p>
            </div>
          )}
          {date && (
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-widest text-faint">Date</p>
              <p className="mt-1 font-mono text-sm text-foreground">{date}</p>
            </div>
          )}
          {archetype && (
            <div className="rounded-lg border border-border bg-surface/50 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-widest text-faint">Role Type</p>
              <p className="mt-1 truncate text-sm font-medium">{archetype}</p>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {app && <StatusSelect n={id} current={app.status} />}
          <PipelineActions
            n={id}
            company={app?.company ?? meta?.title ?? id}
            role={app?.role}
            url={url}
            pdfReady={(app?.pdf ?? "").includes("✅")}
          />
          {url && url.startsWith("http") && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/50 px-3 py-1.5 text-xs font-medium text-brand hover:bg-surface-hover"
            >
              View posting <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {app && canDelete && (
          <div className="mt-3">
            <DeleteFromTracker n={id} />
          </div>
        )}
      </header>

      {report ? (
        <>
          {(() => {
            const { intro, sections } = splitSections(meta?.body ?? report);
            // Tolerant fallback: unrecognized layout → render the whole body as
            // before, so an old/odd report never loses content.
            if (sections.length === 0) {
              return (
                <article className="report-prose mt-8">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{meta?.body ?? report}</ReactMarkdown>
                </article>
              );
            }
            // Verdict (F) leads as a highlighted callout with no competing heading —
            // it's THE answer. A/B stay expanded (fit detail); C–G collapse as
            // content (with a 1-line preview); machine artifacts drop to a dimmer
            // "Technical" tier so the CLI-DNA is present-but-clearly-secondary.
            const verdict = sections.find((s) => s.letter === "F");
            const rest = sections.filter((s) => s !== verdict);
            const machine = rest.filter((s) => isMachine(s.heading));
            const mainSections = rest.filter((s) => !isMachine(s.heading));
            const anyAB = mainSections.some((s) => s.letter === "A" || s.letter === "B");
            return (
              <div className="mt-8">
                {intro && (
                  <article className="report-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
                  </article>
                )}

                {verdict && (
                  <div className="rounded-2xl border border-brand/25 bg-brand-soft/50 px-5 py-4">
                    <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-brand/80">Verdict</p>
                    <article className="report-prose [&_p]:font-medium [&_p]:text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{verdict.content}</ReactMarkdown>
                    </article>
                  </div>
                )}

                {mainSections.map((s, i) => {
                  const expanded = s.letter === "A" || s.letter === "B" || (!anyAB && i === 0);
                  if (expanded) {
                    return (
                      <article key={i} className="report-prose mt-6">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{`## ${cleanHeading(s.heading)}\n\n${s.content}`}</ReactMarkdown>
                      </article>
                    );
                  }
                  return (
                    <details key={i} className="group mt-3 overflow-hidden rounded-xl border border-border bg-surface/30">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-hover">
                        <span className="text-sm font-medium">{cleanHeading(s.heading)}</span>
                        <span className="hidden truncate text-xs text-faint sm:inline">{preview(s.content)}</span>
                        <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="report-prose border-t border-border px-4 py-3">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                      </div>
                    </details>
                  );
                })}

                {machine.length > 0 && (
                  <>
                    <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-faint">
                      <span className="h-px flex-1 bg-border" />
                      Technical details · for developers
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    {machine.map((s, i) => (
                      <details key={i} className="group mt-2 overflow-hidden rounded-xl border border-border/60 bg-surface/20">
                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-3 font-mono text-xs text-muted transition-colors hover:bg-surface-hover">
                          {cleanHeading(s.heading)}
                          <ChevronDown className="ml-auto size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="report-prose border-t border-border/60 px-4 py-3 opacity-80">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                        </div>
                      </details>
                    ))}
                  </>
                )}
              </div>
            );
          })()}
          <ScoreMethodology />
        </>
      ) : (
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 p-5 text-sm text-muted">
          <FileText className="size-5 shrink-0 text-faint" />
          No report file found for #{id} in <code className="text-foreground">reports/</code>.
        </div>
      )}
    </div>
  );
}
