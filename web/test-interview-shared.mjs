import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRounds, parseQuestionBank, questionsForRound } from "./src/lib/interview-shared.ts";

const TABLE_HEADER = `| # | Question | Round | Audience | Status | Source | Last asked |
|---|----------|-------|----------|--------|--------|------------|`;

test("question bank stays inside the requested company section", () => {
  const markdown = `## Alpha — Engineer

${TABLE_HEADER}
| 1 | Alpha question | Round 1 | recruiter-screen | — | [inferred from JD] | — |

## Beta — Engineer

${TABLE_HEADER}
| 2 | Beta question | Round 2 | peer-tech | — | [inferred from JD] | — |`;

  assert.deepEqual(parseQuestionBank(markdown, "Missing", "Engineer"), []);
  assert.deepEqual(parseQuestionBank(markdown, "Beta", "Engineer").map((row) => row.question), ["Beta question"]);
});

test("round 1 does not match round 10", () => {
  const questions = [{
    num: 10,
    question: "Round ten only",
    roundLabel: "Round 10",
    audience: "",
    status: "none",
    source: "",
    sourceTier: "unknown",
    lastAsked: "",
  }];
  const round = baseRound(1, "screen");
  assert.deepEqual(questionsForRound(questions, round), []);
});

test("session completion updates its explicit round without erasing ledger details", () => {
  const first = baseRound(1, "screen");
  const second = { ...baseRound(2, "technical"), scheduledAt: "2026-09-03T14:00", durationMin: 90, interviewers: "Panel" };
  const session = {
    ...baseRound(2, "technical"),
    status: "done",
    scheduledAt: "2026-09-03",
    sessionFile: "session.md",
    outcome: "advanced",
    source: "session",
  };

  const merged = mergeRounds([], [first, second], [session]);
  assert.equal(merged[0].status, "planned");
  assert.deepEqual(
    { roundNo: merged[1].roundNo, status: merged[1].status, durationMin: merged[1].durationMin, interviewers: merged[1].interviewers, outcome: merged[1].outcome },
    { roundNo: 2, status: "done", durationMin: 90, interviewers: "Panel", outcome: "advanced" },
  );
});

function baseRound(roundNo, type) {
  return {
    roundNo,
    type,
    audience: type === "screen" ? "recruiter-screen" : "peer-tech",
    status: "planned",
    scheduledAt: "",
    durationMin: 0,
    interviewers: "",
    format: "",
    sessionFile: "",
    outcome: "pending",
    notes: "",
    source: "ledger",
  };
}
