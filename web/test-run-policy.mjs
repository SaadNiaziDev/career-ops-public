import assert from "node:assert/strict";
import test from "node:test";
import { artifactChanged, fatalExitMessage, intentKey, isStuck, stateFromLegacyStatus } from "./src/lib/jobs/run-policy.ts";

test("canonical intent keys collapse URL and report-number variants", () => {
  assert.equal(intentKey("evaluate", "https://jobs.ashbyhq.com/Acme/abc/application?utm_source=x"), intentKey("evaluate", "https://jobs.ashbyhq.com/acme/abc"));
  assert.equal(intentKey("pdf", "0052"), "pdf:52");
});

test("stderr warnings do not fail a clean process", () => {
  assert.equal(fatalExitMessage({ code: 0, signal: null, timedOut: false, cancelled: false, emittedOutput: true, stderr: "warning: recoverable error while probing fallback" }), null);
});

test("timeout and non-zero exits produce actionable failures", () => {
  assert.match(fatalExitMessage({ code: null, signal: "SIGTERM", timedOut: true, cancelled: false, emittedOutput: true, stderr: "" }), /timed out/i);
  assert.match(fatalExitMessage({ code: 2, signal: null, timedOut: false, cancelled: false, emittedOutput: true, stderr: "authentication required" }), /needs authentication/i);
  assert.equal(fatalExitMessage({ code: null, signal: "SIGTERM", timedOut: false, cancelled: true, emittedOutput: true, stderr: "" }), null);
});

test("artifact validation rejects stale files and accepts changed files", () => {
  const before = new Map([["052-acme.md", "100:10"]]);
  assert.equal(artifactChanged(before, new Map(before), "052-acme.md"), false);
  assert.equal(artifactChanged(before, new Map([["052-acme.md", "110:11"]]), "052-acme.md"), true);
});

test("reload and inactivity states remain explicit", () => {
  assert.equal(stateFromLegacyStatus("error"), "needs-attention");
  assert.equal(isStuck("running", 0, 90_000), true);
  assert.equal(isStuck("completed", 0, 999_999), false);
});
