import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validateActivityInput } from "../src/lib/application-activity-shared.ts";
import { archiveOutreach } from "../src/lib/application-activity-outreach.ts";
import { readActivity, saveActivity } from "../src/lib/application-activity-store.ts";

// The store lives in SQLite under CAREER_OPS_ROOT; each test gets its own root.
function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "career-activity-"));
  process.env.CAREER_OPS_ROOT = root;
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function valid(overrides = {}) {
  return { id: randomUUID(), n: "1", kind: "application", channel: "company-site", confirmed: true, ...overrides };
}

test("opening a draft is insufficient proof of sending", () => {
  assert.throws(() => validateActivityInput(valid({ kind: "email", confirmed: false })), /Confirm/);
  assert.throws(() => validateActivityInput(valid({ kind: "followup", confirmed: false })), /Confirm/);
  assert.throws(() => validateActivityInput(valid({ confirmed: false })), /Confirm/);
});

test("messages preserve recipient and exact multiline text, including email applications", () => {
  const body = "\nHi Jane,\n\nHere are the details.\nThanks.\n";
  assert.equal(validateActivityInput(valid({ kind: "email", recipient: "jane@example.com", body })).body, body);
  assert.throws(() => validateActivityInput(valid({ kind: "email", body })), /recipient/);
  assert.throws(() => validateActivityInput(valid({ channel: "email", recipient: "jane@example.com" })), /exact message/);
});

test("history rejects traversal, future dates, unsafe links, and oversized content", () => {
  for (const n of ["../2", "0", "01", "1/2"]) assert.throws(() => validateActivityInput(valid({ n })));
  assert.throws(() => validateActivityInput(valid({ id: "../../file" })));
  assert.throws(() => validateActivityInput(valid({ url: "javascript:alert(1)" })), /HTTP/);
  assert.throws(() => validateActivityInput(valid({ occurredAt: "2099-01-01T00:00:00Z" })), /past/);
  assert.throws(() => validateActivityInput(valid({ body: "x".repeat(20_001) })), /body/);
});

test("record retries are idempotent and can never overwrite an earlier message", (t) => {
  const root = tempRoot(t);
  const event = { id: randomUUID(), n: "1", kind: "email", channel: "gmail", recipient: "jane@example.com", body: "Original message", at: "2026-01-01T12:00:00.000Z" };
  saveActivity(root, event);
  assert.deepEqual(saveActivity(root, { ...event, at: "2026-01-02T12:00:00.000Z" }), event);
  assert.throws(() => saveActivity(root, { ...event, body: "Changed after sending" }), /already used/);
  saveActivity(root, { ...event, id: randomUUID(), body: "A separate follow-up", at: "2026-01-03T12:00:00.000Z" });
  const records = readActivity(root, "1");
  assert.equal(records.length, 2);
  assert.equal(records[0].body, "A separate follow-up");
  assert.equal(records[1].body, "Original message");
  assert.deepEqual(readActivity(root, "2"), []);
});


test("outreach confirmations archive the actual message once and follow-ups separately", (t) => {
  const root = tempRoot(t);
  const record = { id: "1-jane", trackerNum: "1", contact: { name: "Jane", email: "jane@example.com" }, subject: "Hello", body: "Original email\n", status: "sent", sentAt: "2026-01-01T12:00:00Z", sentVia: "gmail", followups: [{ day: 3, body: "Following up", sentAt: "2026-01-04T12:00:00Z" }] };
  archiveOutreach(root, record);
  archiveOutreach(root, { ...record, sentAt: "2026-01-01T12:01:00Z" });
  assert.equal(readActivity(root, "1").length, 1);
  assert.throws(() => archiveOutreach(root, { ...record, body: "Edited later" }), /already used/);
  archiveOutreach(root, record, 3);
  const events = readActivity(root, "1");
  assert.equal(events.length, 2);
  assert.equal(events[0].body, "Following up");
  assert.equal(events[1].body, "Original email\n");
});
