import test from "node:test";
import assert from "node:assert/strict";
import { gmailComposeUrl, isFollowupDue, nextFollowup, followupSubject, addDays } from "./src/lib/outreach-shared.ts";

test("gmail compose url carries recipient, subject and body", () => {
  const url = new URL(gmailComposeUrl("jane@acme.com", "Frontend role & you", "Hi Jane,\n\nLine two"));
  assert.equal(url.hostname, "mail.google.com");
  assert.equal(url.searchParams.get("view"), "cm");
  assert.equal(url.searchParams.get("to"), "jane@acme.com");
  assert.equal(url.searchParams.get("su"), "Frontend role & you");
  assert.equal(url.searchParams.get("body"), "Hi Jane,\n\nLine two");
});

test("follow-ups come due in order and stop after a reply", () => {
  const base = { status: "sent", subject: "Hi", followups: [
    { day: 3, body: "a", dueAt: addDays("2026-11-01", 3) },
    { day: 5, body: "b", dueAt: addDays("2026-11-01", 5) },
  ] };
  assert.equal(nextFollowup(base)?.day, 3);
  assert.equal(isFollowupDue(base, "2026-11-03"), false);
  assert.equal(isFollowupDue(base, "2026-11-04"), true);
  base.followups[0].sentAt = "2026-11-04";
  assert.equal(nextFollowup(base)?.day, 5);
  assert.equal(isFollowupDue({ ...base, status: "replied" }, "2026-12-01"), false);
  assert.equal(followupSubject("Re: Hi"), "Re: Hi");
  assert.equal(followupSubject("Hi"), "Re: Hi");
});
