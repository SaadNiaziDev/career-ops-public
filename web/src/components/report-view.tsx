"use client";

import Link from "next/link";
import { ArrowLeftOutlined, ExportOutlined, FileTextOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Progress,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  FileSearchOutlined,
  EditOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import type { Application } from "@/lib/career-ops";
import { scoreTone, scoreNum, legitimacyTone, parseReport } from "@/lib/format";
import { StatusSelect } from "@/components/status-select";
import { CompanyLogo } from "@/components/company-logo";
import { ScoreMethodology } from "@/components/score-methodology";
import { PipelineActions } from "@/components/pipeline/pipeline-actions";
import { DeleteFromTracker } from "@/components/delete-from-tracker";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { HeroGlow } from "@/components/hero-glow";
import { cn } from "@/lib/cn";

const { Text, Paragraph } = Typography;

type Section = { heading: string; letter: string | null; content: string };

const TONE_TEXT = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-red-500",
  muted: "text-foreground",
} as const;

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

  const alertType = (() => {
    if (applies === true) return "success";
    if (applies === false) return "warning";
    const t = score ? scoreTone(score) : "muted";
    if (t === "good") return "success";
    if (t === "bad") return "error";
    if (t === "warn") return "warning";
    return "info";
  })();

  const sectionItems = (items: Section[]) =>
    items.map((s) => ({
      key: s.heading,
      label: (
        <div className="flex min-w-0 items-start gap-2.5 pr-2">
          {s.letter && <span className="report-letter-badge">{s.letter}</span>}
          <div className="min-w-0">
            <Text strong className="text-sm">
              {cleanHeading(s.heading)}
            </Text>
            <div>
              <Text type="secondary" className="text-xs">
                {preview(s.content)}
              </Text>
            </div>
          </div>
        </div>
      ),
      children: (
        <article className="report-prose-compact">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
        </article>
      ),
    }));

  const evidenceItems = sectionItems(evidence);
  const draftItems = sectionItems(drafts);

  return (
    <div className="dossier-inset-stack">
      {intro && (
        <article className="report-prose-compact">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
        </article>
      )}

      <Alert
        type={alertType}
        showIcon
        className="report-verdict-alert"
        message="Recommendation"
        description={
          <article className="report-prose-compact [&_p:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{recommendationMd}</ReactMarkdown>
          </article>
        }
      />

      {evidenceItems.length > 0 && (
        <Collapse
          className="report-toplevel-collapse"
          items={[
            {
              key: "evidence",
              label: (
                <Space size={10}>
                  <span className="report-section-icon">
                    <FileSearchOutlined />
                  </span>
                  <span>
                    <Text strong className="text-sm">
                      Full evaluation
                    </Text>{" "}
                    <Text type="secondary" className="text-xs">
                      · {evidenceItems.length} sections
                    </Text>
                  </span>
                </Space>
              ),
              children: (
                <Collapse
                  ghost
                  className="report-section-collapse -mx-1"
                  items={evidenceItems}
                />
              ),
            },
          ]}
        />
      )}

      {draftItems.length > 0 && (
        <Collapse
          className="report-toplevel-collapse"
          items={[
            {
              key: "drafts",
              label: (
                <Space size={10}>
                  <span className="report-section-icon">
                    <EditOutlined />
                  </span>
                  <Text strong className="text-sm">
                    Drafts & keywords
                  </Text>{" "}
                  <Text type="secondary" className="text-xs">
                    · {draftItems.length}
                  </Text>
                </Space>
              ),
              children: <Collapse ghost className="report-section-collapse -mx-1" items={draftItems} />,
            },
          ]}
        />
      )}

      {machine.length > 0 && (
        <Collapse
          className="report-toplevel-collapse"
          items={[
            {
              key: "technical",
              label: (
                <Space size={10}>
                  <span className="report-section-icon">
                    <CodeOutlined />
                  </span>
                  <Text strong className="text-sm">
                    Technical details
                  </Text>
                </Space>
              ),
              children: (
                <Collapse
                  ghost
                  size="small"
                  items={machine.map((s) => ({
                    key: s.heading,
                    label: <Text code className="text-xs">{cleanHeading(s.heading)}</Text>,
                    children: (
                      <article className="report-prose-compact opacity-80">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                      </article>
                    ),
                  }))}
                />
              ),
            },
          ]}
        />
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
        <Space size={8} className="text-sm">
          <Link href="/pipeline">
            <Button type="text" size="small" icon={<ArrowLeftOutlined />} className="px-0">
              Pipeline
            </Button>
          </Link>
          <Text type="secondary">/</Text>
          <Text type="secondary" className="text-xs">
            #{id}
          </Text>
        </Space>

        <header className="report-hero dot-bg relative overflow-hidden rounded-2xl border border-border bg-surface/50">
          <HeroGlow />
          <div className="relative z-10 flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <CompanyLogo name={company} size={48} />
            <div className="min-w-0 flex-1">
              <Text type="secondary" className="font-mono text-[11px] uppercase tracking-[0.2em]">
                Report #{id}
              </Text>
              <Typography.Title level={2} className="mb-0! mt-1! truncate font-display!">
                {company}
              </Typography.Title>
              {app?.role && (
                <Paragraph type="secondary" className="mb-0! mt-0.5! truncate text-sm">
                  {app.role}
                </Paragraph>
              )}
            </div>
            {score && (
              <div
                className={cn(
                  "report-score-badge shrink-0",
                  tone === "good" && "report-score-badge--good",
                  tone === "warn" && "report-score-badge--warn",
                  tone === "bad" && "report-score-badge--bad",
                )}
              >
                <span className={cn("report-score-num", TONE_TEXT[tone])}>{formatScoreDisplay(score)}</span>
                <span className="report-score-max">/5</span>
              </div>
            )}
          </div>
          {applies != null && (
            <div className="relative z-10 border-t border-border/60 px-5 py-3 sm:px-6">
              <Tag color={applies ? "success" : "default"} className="m-0">
                {applies ? "Worth applying" : "Below apply line"}
              </Tag>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          <main className="min-w-0">
            {report ? (
              <ReportBody
                body={meta?.body ?? report}
                score={score}
                applies={applies}
                notes={app?.notes}
              />
            ) : (
              <Empty
                image={<FileTextOutlined className="text-3xl text-[var(--ant-color-text-secondary)]" />}
                description={
                  <>
                    No report file found for #{id} in <Text code>reports/</Text>.
                  </>
                }
              />
            )}
          </main>

          <aside className="dossier-stack lg:sticky lg:top-6">
            <Card size="small" title="Next steps" className="report-meta-card">
              <PipelineActions
                n={id}
                company={company}
                role={app?.role}
                url={url}
                pdfReady={(app?.pdf ?? "").includes("✅")}
                variant="rail"
              />
              {url && url.startsWith("http") && (
                <Button
                  block
                  size="small"
                  className="mt-2"
                  icon={<ExportOutlined />}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View posting
                </Button>
              )}
            </Card>

            <Card size="small" title="At a glance" className="report-meta-card">
              {score ? (
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Text type="secondary" className="text-xs">
                      Fit score
                    </Text>
                    <Text strong className={cn("tabular-nums", TONE_TEXT[tone])}>
                      {formatScoreDisplay(score)}
                    </Text>
                  </div>
                  {!Number.isNaN(n) && (
                    <>
                      <div className="report-score-track relative">
                        <Progress
                          percent={Math.min(Math.max(n / 5, 0), 1) * 100}
                          showInfo={false}
                          size="small"
                          strokeColor={
                            tone === "good"
                              ? "var(--ant-color-success)"
                              : tone === "warn"
                                ? "var(--ant-color-warning)"
                                : tone === "bad"
                                  ? "var(--ant-color-error)"
                                  : undefined
                          }
                        />
                        <div className="report-apply-line" style={{ left: "80%" }} aria-hidden />
                      </div>
                      <div className="relative mt-1 h-3 text-[10px] text-[var(--ant-color-text-secondary)]">
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
                <Text type="secondary" className="text-xs">
                  No score on record.
                </Text>
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
                <div className="mt-3 border-t border-[var(--ant-color-border)] pt-3">
                  <DeleteFromTracker n={id} />
                </div>
              )}
            </Card>

            <ScoreMethodology />
          </aside>
        </div>
      </DossierStack>
    </PageShell>
  );
}
