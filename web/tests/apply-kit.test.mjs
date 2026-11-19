import assert from "node:assert/strict";
import test from "node:test";
import { answerStats, copyAllText, coverNeed, kitSteps, needsInput, plainText, profileSuggestion, readiness, sensitiveKind, usable } from "../src/lib/apply/kit.ts";

test("flags questions only the candidate can answer", () => {
  assert.equal(sensitiveKind("What are your salary expectations?"), "salary");
  assert.equal(sensitiveKind("Will you now or in the future require visa sponsorship?"), "visa");
  assert.equal(sensitiveKind("What is your earliest start date?"), "start");
  assert.equal(sensitiveKind("What are your pronouns?"), "demographic");
  assert.equal(sensitiveKind("LinkedIn Profile"), null);
  // Salary stays flagged even with a value; demographic only while empty.
  assert.equal(needsInput({ label: "Salary expectation", value: "Negotiable", type: "text" }), true);
  assert.equal(needsInput({ label: "Pronouns", value: "he/him", type: "select" }), false);
  assert.equal(needsInput({ label: "Pronouns", value: "", type: "select" }), true);
  assert.equal(needsInput({ label: "Resume", value: "", type: "file" }), false);
});

test("profile placeholders are never suggested", () => {
  assert.equal(usable("Not specified — confirm with candidate before use"), undefined);
  assert.equal(usable("Not specified"), undefined);
  assert.equal(usable("  "), undefined);
  assert.equal(usable("PKR 400000-500000"), "PKR 400000-500000");
  assert.equal(profileSuggestion("salary", { salary: "USD 60k" }), "USD 60k");
  assert.equal(profileSuggestion("demographic", { salary: "USD 60k" }), undefined);
});

test("cover letter need comes from the form's own fields", () => {
  assert.equal(coverNeed([], false), "unknown");
  assert.equal(coverNeed([{ label: "Email" }], true), "none");
  assert.equal(coverNeed([{ label: "Cover Letter", required: true }], true), "required");
  assert.equal(coverNeed([{ label: "Motivation letter (optional)" }], true), "optional");
});

test("stats, readiness and steps", () => {
  const fields = [
    { label: "Name", value: "Ada", type: "text", source: "ai" },
    { label: "Salary", value: "", type: "text", source: "ai" },
    { label: "Resume", value: "cv.pdf", type: "file", source: "profile" },
  ];
  assert.deepEqual(answerStats(fields), { answered: 1, total: 2, flagged: 1 });
  assert.equal(copyAllText(fields), "Name\nAda");
  assert.deepEqual(readiness({ cvReady: true, coverReady: false, coverNeed: "none", answered: 0 }), { done: 1, total: 2 });
  assert.deepEqual(readiness({ cvReady: true, coverReady: true, coverNeed: "required", answered: 3 }), { done: 3, total: 3 });
  const steps = kitSteps({
    app: { n: "1", reportNum: "1", company: "Acme", role: "Eng", score: 4.2, status: "Evaluated", date: "", url: "https://jobs.example.com/1" },
    cv: { ready: true },
    cover: { ready: false, need: "none" },
    answers: { state: "draft", fields: [], answered: 2, total: 3, flagged: 0 },
  });
  assert.deepEqual(steps, { cv: "done", answers: "done", cover: "skipped", open: "todo", applied: "todo" });
});

test("plain-text cover letter for the clipboard", () => {
  assert.equal(plainText("# Cover\n\nI **built** the [app](https://x.dev)."), "Cover\n\nI built the app (https://x.dev).");
});
