import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { authArgs, cliProbePassed } from "./src/lib/onboarding/readiness-policy.ts";
import { onboardingVerificationPending } from "./src/lib/onboarding/readiness-state.ts";

test("every supported CLI has a non-generative authentication probe", () => {
  assert.deepEqual(authArgs("claude"), ["auth", "status", "--json"]);
  assert.deepEqual(authArgs("codex"), ["login", "status"]);
  assert.deepEqual(authArgs("cursor"), ["status", "--format", "json"]);
  assert.equal(authArgs("missing"), null);
});

test("authentication probe rejects non-zero and signed-out responses", () => {
  assert.equal(cliProbePassed(1, ""), false);
  assert.equal(cliProbePassed(0, "Not logged in"), false);
  assert.equal(cliProbePassed(0, '{"loggedIn":false}'), false);
  assert.equal(cliProbePassed(0, "Logged in using ChatGPT"), true);
});

test("failed setup survives reload until a successful smoke test", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-onboarding-"));
  fs.mkdirSync(path.join(root, ".career-ops-web"));
  const status = path.join(root, ".career-ops-web", "onboarding.json");
  fs.writeFileSync(status, JSON.stringify({ ready: false }));
  assert.equal(onboardingVerificationPending(root), true);
  fs.writeFileSync(status, JSON.stringify({ ready: true }));
  assert.equal(onboardingVerificationPending(root), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("onboarding UI checks every response and exposes recovery diagnostics", () => {
  const ingest = fs.readFileSync(new URL("./src/components/cv/cv-ingest.tsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("./src/components/home/first-run-home.tsx", import.meta.url), "utf8");
  assert.match(ingest, /if \(!response\.ok\) throw new Error/);
  assert.match(home, /Copy diagnostics/);
  assert.match(home, /career-ops:onboarding-diagnostics/);
  assert.doesNotMatch(home, /Skip — paste a job URL/);
});
