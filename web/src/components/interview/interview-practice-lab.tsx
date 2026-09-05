"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/material-symbol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Textarea } from "@/components/ui/md3-input";
import type { Job } from "@/components/jobs/job-store";
import { drillsForRound } from "@/lib/interview-drills";
import type { InterviewRound, QuestionBankRow } from "@/lib/interview-shared";

type PracticeMode = "role" | "lab";

type PracticeItem = {
  id: string;
  title: string;
  prompt: string;
  source: string;
  difficulty?: string;
  minutes?: number;
  constraints: string[];
  hints: string[];
  rubric: string[];
};

type Props = {
  trackerNum: string;
  round: InterviewRound;
  questions: QuestionBankRow[];
  latestJob?: Job;
  running: boolean;
  onRun: (kind: string, title: string, context?: Record<string, unknown>) => void;
};

export function InterviewPracticeLab({ trackerNum, round, questions, latestJob, running, onRun }: Props) {
  const roleItems = useMemo(() => questions.map(questionItem), [questions]);
  const labItems = useMemo(() => drillsForRound(round).map(drillItem), [round]);
  const [mode, setMode] = useState<PracticeMode>(roleItems.length > 0 ? "role" : "lab");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintCount, setHintCount] = useState(0);
  const [showRubric, setShowRubric] = useState(false);

  const items = mode === "role" ? roleItems : labItems;
  const item = items[index] ?? null;
  const storageKey = `career-ops:interview-practice:${trackerNum}:r${round.roundNo}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setAnswers(raw ? JSON.parse(raw) : {});
    } catch {
      setAnswers({});
    }
  }, [storageKey]);

  useEffect(() => {
    setIndex(0);
    setHintCount(0);
    setShowRubric(false);
  }, [mode, round.roundNo]);

  const answer = item ? answers[item.id] ?? "" : "";
  const completed = items.filter((candidate) => (answers[candidate.id] ?? "").trim()).length;

  const updateAnswer = (value: string) => {
    if (!item) return;
    const next = { ...answers, [item.id]: value };
    setAnswers(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* browser storage is optional */
    }
  };

  const move = (next: number) => {
    setIndex(Math.max(0, Math.min(next, items.length - 1)));
    setHintCount(0);
    setShowRubric(false);
  };

  const submit = () => {
    if (!item || !answer.trim()) return;
    onRun("interview-practice", `Practice · ${item.title}`, {
      round: round.roundNo,
      roundType: round.type,
      questions: [item.prompt],
      answers: [answer],
      rubric: item.rubric,
      practiceSource: mode === "lab" ? "career-ops original drill" : item.source,
    });
    setShowRubric(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-tertiary-container)] p-3 text-[var(--md-sys-color-on-tertiary-container)]">
        <div>
          <p className="font-medium">Practice without leaving career-ops</p>
          <p className="text-sm opacity-80">Prompts, hints, answer space, feedback, and progress are all here.</p>
        </div>
        <Badge tone="muted">{completed}/{items.length} drafted</Badge>
      </div>

      <Md3Segmented
        value={mode}
        onChange={setMode}
        aria-label="Practice source"
        options={[
          { value: "role", label: `Role questions (${roleItems.length})` },
          { value: "lab", label: `Practice lab (${labItems.length})` },
        ]}
      />

      {!item ? (
        <Md3Empty icon="quiz" description="No role questions yet. Use the Practice lab or mine questions from the workspace." />
      ) : (
        <>
          <section className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="muted">{index + 1} / {items.length}</Badge>
              {item.difficulty ? <Badge tone="warn">{item.difficulty}</Badge> : null}
              {item.minutes ? <Badge tone="muted">{item.minutes} min</Badge> : null}
              <span className="ml-auto text-xs text-[var(--md-sys-color-on-surface-variant)]">{item.source}</span>
            </div>
            <h3 className="md-title-medium text-[var(--md-sys-color-on-surface)]">{item.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--md-sys-color-on-surface)]">{item.prompt}</p>

            {item.constraints.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">Keep in mind</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  {item.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
                </ul>
              </div>
            ) : null}
          </section>

          <Md3Textarea
            aria-label={`Answer for ${item.title}`}
            placeholder={mode === "lab" ? "Think aloud here: assumptions, approach, tradeoffs, pseudocode or code…" : "Write the answer you would give in the interview…"}
            value={answer}
            onChange={(event) => updateAnswer(event.target.value)}
            className="min-h-[220px] font-mono text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={hintCount >= item.hints.length} onClick={() => setHintCount((count) => count + 1)}>
              <MaterialSymbol name="lightbulb" size={18} />
              {hintCount === 0 ? "Give me a hint" : "Next hint"}
            </Button>
            <Button variant="outline" onClick={() => setShowRubric((shown) => !shown)}>
              <MaterialSymbol name="checklist" size={18} />
              Strong answer checklist
            </Button>
            <Button disabled={running || !answer.trim()} onClick={submit}>
              <MaterialSymbol name="rate_review" size={18} />
              {running ? "Reviewing…" : "Review my answer"}
            </Button>
          </div>

          {hintCount > 0 ? (
            <div className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-secondary-container)] p-3 text-sm text-[var(--md-sys-color-on-secondary-container)]">
              <p className="mb-1 font-medium">Hints revealed</p>
              <ol className="list-decimal space-y-1 pl-5">
                {item.hints.slice(0, hintCount).map((hint) => <li key={hint}>{hint}</li>)}
              </ol>
            </div>
          ) : null}

          {showRubric ? (
            <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-3">
              <p className="mb-1 text-sm font-medium">A strong answer should</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {item.rubric.map((criterion) => <li key={criterion}>{criterion}</li>)}
              </ul>
            </div>
          ) : null}

          {latestJob ? <Feedback job={latestJob} /> : null}

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" disabled={index === 0} onClick={() => move(index - 1)}>
              <MaterialSymbol name="arrow_back" size={18} /> Previous
            </Button>
            <Button variant="ghost" disabled={index >= items.length - 1} onClick={() => move(index + 1)}>
              Next <MaterialSymbol name="arrow_forward" size={18} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Feedback({ job }: { job: Job }) {
  return (
    <section className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="md-title-small">Coach feedback</h3>
        <Badge tone={job.status === "done" ? "good" : job.status === "error" ? "bad" : "warn"}>{job.status}</Badge>
      </div>
      {job.text ? (
        <article className="report-prose-compact"><ReactMarkdown remarkPlugins={[remarkGfm]}>{job.text}</ReactMarkdown></article>
      ) : (
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Your local agent is reviewing the answer. Feedback will appear here.</p>
      )}
    </section>
  );
}

function questionItem(question: QuestionBankRow): PracticeItem {
  return {
    id: `question-${question.num}`,
    title: `Question ${question.num}`,
    prompt: question.question,
    source: question.source || "Role question",
    constraints: [],
    hints: [
      "Start with your conclusion or result before giving the chronology.",
      "Use one defensible example and make your own action explicit.",
      "Close with the effect, tradeoff, or lesson that matters for this role.",
    ],
    rubric: [
      "Answers the exact question directly.",
      "Uses only claims supported by the CV, profile, or story bank.",
      "Shows the candidate's judgment and contribution.",
      "Ends with a concrete result or reflection.",
    ],
  };
}

function drillItem(drill: ReturnType<typeof drillsForRound>[number]): PracticeItem {
  return { ...drill, source: "Original career-ops drill" };
}
