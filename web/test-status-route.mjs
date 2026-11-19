import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { canonicalState, updateApplicationStatus } from "./src/lib/application-status.ts";
import { db } from "./src/lib/db.ts";

function seed(t, score = "4.2/5") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "career-status-"));
  process.env.CAREER_OPS_ROOT = root;
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  db().prepare("INSERT INTO applications (n, date, company, role, score, status, report, notes) VALUES (1, '2026-01-01', 'Example Co', 'Engineer', ?, 'Evaluated', '[1]', '')").run(score);
}

test("status labels and aliases resolve to canonical states", () => {
  assert.equal(canonicalState("applied"), "Applied");
  assert.equal(canonicalState("**Entrevista**"), "Interview");
  assert.equal(canonicalState("no aplicar"), "SKIP");
  assert.equal(canonicalState("Nonsense"), null);
});

test("status changes are saved with a history event", async (t) => {
  seed(t);
  await assert.rejects(updateApplicationStatus({ n: 1, status: "Applied" }), /Confirm/);
  await assert.rejects(updateApplicationStatus({ n: 1, status: "Bogus" }), /invalid status/);
  await assert.rejects(updateApplicationStatus({ n: 9, status: "Rejected" }), /not found/);
  const result = await updateApplicationStatus({ n: 1, status: "Applied", confirmedSubmission: true });
  assert.equal(result.status, "Applied");
  assert.equal(db().prepare("SELECT status FROM applications WHERE n = 1").get().status, "Applied");
  const event = db().prepare("SELECT data FROM events WHERE n = 1 AND kind = 'status'").get();
  assert.deepEqual(JSON.parse(event.data), { from: "Evaluated", to: "Applied" });
});

test("applying below 4.0 needs a reason, which is kept in notes", async (t) => {
  seed(t, "3.2/5");
  await assert.rejects(updateApplicationStatus({ n: 1, status: "Applied", confirmedSubmission: true }), /below 4.0/);
  await updateApplicationStatus({ n: 1, status: "Applied", confirmedSubmission: true, overrideReason: "Referral from a friend" });
  assert.match(db().prepare("SELECT notes FROM applications WHERE n = 1").get().notes, /Referral from a friend/);
});
