import test from "node:test";
import assert from "node:assert/strict";
import { completionError, createRunTaskRegistry, getRunTask, runTaskKinds } from "./src/lib/jobs/run-task-registry.ts";

test("one immutable descriptor owns every /api/run kind and unknown kinds fail closed", () => {
  const prompted = [];
  const registry = createRunTaskRegistry((kind, ...args) => {
    prompted.push(kind);
    return `${kind}:${args.join("|")}`;
  });
  const descriptors = Object.values(registry);
  assert.equal(descriptors.length, 14);
  for (const task of descriptors) {
    assert.equal(registry[task.kind], task);
    assert.equal(typeof task.prompt, "function");
    assert.equal(typeof task.requiredFile, "string");
    assert.equal(typeof task.requiresCv, "boolean");
    assert.ok(["fetch", "local-analysis", "write"].includes(task.workerPhase));
    assert.ok(task.timeoutMs > 0);
    assert.ok(["report", "pdf", "writes", "output"].includes(task.completionCheck));
    assert.equal(task.prompt("input", "memory"), `${task.kind}:input|memory`);
  }
  assert.deepEqual(prompted, descriptors.map((task) => task.kind));
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry.evaluate), true);
  assert.equal(getRunTask(registry, "not-a-task"), null);
});

test("all descriptor-specific completion verifiers reject missing proof and accept valid proof", () => {
  const registry = createRunTaskRegistry((kind) => kind);
  for (const task of Object.values(registry)) {
    const evidence = task.completionCheck === "report" ? { reportChanged: true }
      : task.completionCheck === "pdf" ? { pdfVerified: true }
        : task.completionCheck === "writes" ? { writesChanged: true }
          : { emittedOutput: true };
    assert.equal(typeof completionError(task, {}), "string", `${task.kind} should fail without proof`);
    assert.equal(completionError(task, evidence), null, `${task.kind} should pass with proof`);
  }
});

test("groups and execution policy are declared on the registry entries", () => {
  const registry = createRunTaskRegistry((kind) => kind);
  assert.deepEqual(runTaskKinds(registry, "interview"), [
    "interview-prep", "interview-questions", "interview-plan", "interview-practice", "interview-debrief", "interview-redflag",
  ]);
  assert.equal(registry.evaluate.timeoutMs, 720_000);
  assert.equal(registry.pdf.timeoutMs, 720_000);
  assert.equal(registry.contacto.timeoutMs, 360_000);
  assert.equal(registry["interview-questions"].timeoutMs, 360_000);
  assert.equal(registry["interview-practice"].timeoutMs, 300_000);
  assert.equal(registry.research.workerPhase, "fetch");
  assert.ok(Object.values(registry).filter((task) => task.kind !== "research").every((task) => task.workerPhase === "write"));
});
