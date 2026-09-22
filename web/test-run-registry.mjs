import assert from "node:assert/strict";
import test from "node:test";
import { acquireRun, attachRunCancellation, cancelRun, releaseRun } from "./src/lib/core/run-registry.ts";

test("duplicate active intent is rejected and exposes the active run", () => {
  const first = acquireRun("job-first", "evaluate:example");
  const duplicate = acquireRun("job-second", "evaluate:example");
  assert.equal(first.accepted, true);
  assert.deepEqual(duplicate, { accepted: false, existingRunId: "job-first" });
  releaseRun("job-first");
});

test("cancellation terminates the registered run and clean retry succeeds after release", () => {
  let cancelled = false;
  acquireRun("job-cancel", "pdf:52");
  attachRunCancellation("job-cancel", () => { cancelled = true; });
  assert.equal(cancelRun("job-cancel"), true);
  assert.equal(cancelled, true);
  assert.equal(acquireRun("job-too-soon", "pdf:52").accepted, false);
  releaseRun("job-cancel");
  assert.equal(acquireRun("job-retry", "pdf:52").accepted, true);
  releaseRun("job-retry");
});
