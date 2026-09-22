import assert from "node:assert/strict";
import test from "node:test";
import { detectAtsVendor, isSensitiveField, mergeLiveValues, parseApplicationSnapshot, restoredAnswers, snapshotFields } from "./src/lib/apply/snapshot.ts";

const fields = [
  { id: "salary", label: "Salary expectation", type: "text", required: true },
  { id: "why", label: "Why us?", type: "textarea", required: true },
  { id: "captcha", label: "CAPTCHA response", type: "text", required: true },
];

test("captures exact values and their origin without sensitive fields", () => {
  const saved = snapshotFields(fields, { salary: "USD 120,000/year", why: "Because…", captcha: "secret" }, { salary: "user", why: "ai", captcha: "user" });
  assert.deepEqual(saved.map(({ label, value, source }) => ({ label, value, source })), [
    { label: "Salary expectation", value: "USD 120,000/year", source: "user" },
    { label: "Why us?", value: "Because…", source: "ai" },
  ]);
  assert.equal(isSensitiveField({ label: "Password", type: "text" }), true);
});

test("restores a saved snapshot by stable id and label", () => {
  const snapshot = { state: "draft", vacancyUrl: "https://example.com/job", fields: [
    { id: "old-id", label: "Salary expectation", value: "$110k", type: "text", source: "user" },
  ] };
  assert.equal(restoredAnswers(snapshot, fields).answers.salary, "$110k");
});

test("submission capture uses values edited on the live employer form", () => {
  const saved = snapshotFields(fields, { salary: "$100k" }, { salary: "profile" });
  const merged = mergeLiveValues(saved, [{ id: "salary", label: "Salary expectation", type: "text", value: "$115k" }]);
  assert.equal(merged[0].value, "$115k");
  assert.equal(merged[0].source, "user");
});

test("parses the machine snapshot and detects ATS vendors", () => {
  const snapshot = { state: "submitted", vacancyUrl: "https://jobs.ashbyhq.com/acme/1", fields: [] };
  const report = `## Application Answers\n\n\`\`\`application-answers-json\n${JSON.stringify(snapshot)}\n\`\`\``;
  assert.deepEqual(parseApplicationSnapshot(report), snapshot);
  assert.equal(detectAtsVendor(snapshot.vacancyUrl), "Ashby");
});
