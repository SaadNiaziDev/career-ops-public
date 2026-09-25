import { test } from "node:test";
import assert from "node:assert/strict";
import {
  firstScoreSeenKey,
  resolveFirstScoreIdentity,
  selectSessionEvaluation,
} from "./src/lib/jobs/first-score-policy.ts";

const successful = {
  id: "run-1",
  kind: "evaluate",
  state: "completed",
  status: "done",
  input: "https://jobs.ashbyhq.com/Acme/abc-123?utm_source=mail",
  title: "Opaque pasted URL",
};

test("old hydrated evaluations do not trigger without a current-session completion id", () => {
  assert.equal(selectSessionEvaluation([successful], null), null);
  assert.equal(selectSessionEvaluation([successful], "another-run"), null);
});

test("only the explicitly completed successful evaluation can trigger", () => {
  assert.equal(selectSessionEvaluation([successful], "run-1"), successful);
  assert.equal(selectSessionEvaluation([{ ...successful, status: "error" }], "run-1"), null);
  assert.equal(selectSessionEvaluation([{ ...successful, kind: "scan" }], "run-1"), null);
  assert.equal(selectSessionEvaluation([{ ...successful, state: "failed" }], "run-1"), null);
});

test("pasted URL resolves to saved tracker identity, not the opaque job title", () => {
  const applications = [{
    n: "26",
    company: "Acme",
    role: "Frontend Engineer",
    url: "https://jobs.ashbyhq.com/acme/abc-123",
  }];
  assert.deepEqual(resolveFirstScoreIdentity(successful, applications), {
    reportN: "26",
    company: "Acme",
    role: "Frontend Engineer",
    href: "/pipeline/26",
  });
});

test("missing tracker identity is not guessed from UI title or subtitle", () => {
  assert.equal(resolveFirstScoreIdentity({ ...successful, input: "plain pasted text" }, []), null);
});

test("seen state is isolated by completed job, so reload history cannot suppress a new reveal", () => {
  assert.notEqual(firstScoreSeenKey("run-1"), firstScoreSeenKey("run-2"));
  assert.equal(selectSessionEvaluation([successful], null), null);
});
