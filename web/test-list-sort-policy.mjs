import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicationOrderFromParams,
  knownDay,
  offerDeadlineFromNotes,
  readSortPreference,
  scheduledInterviewDates,
  sortApplications,
  sortContacts,
  sortFollowups,
  sortInbox,
  sortOffers,
  sortTodayFocus,
  writeSortPreference,
} from "./src/lib/list-sort-policy.ts";

const app = (n, date, score = "4/5", extra = {}) => ({ n, date, score, company: `Company ${n}`, role: "Engineer", status: "Applied", ...extra });

test("date ordering validates dates and does not promote unknown or timezone-less times", () => {
  assert.equal(knownDay("2026-02-30"), null);
  assert.equal(knownDay("2026-09-25T23:50"), "2026-09-25");
  assert.deepEqual(sortApplications([app("1", "unknown"), app("2", "2026-09-24"), app("3", "2026-09-25T23:50")], "ALL").map((a) => a.n), ["3", "2", "1"]);
});

test("Pipeline defaults reflect each stage, with stable ties", () => {
  const rows = [app("2", "2026-09-24", "3/5"), app("1", "2026-09-25", "5/5"), app("3", "2026-09-25", "5/5")];
  for (const stage of ["ALL", "APPLIED", "RESPONDED", "REJECTED"]) {
    assert.deepEqual(sortApplications(rows, stage).map((a) => a.n), ["1", "3", "2"]);
  }
  assert.deepEqual(sortApplications(rows, "EVALUATED").map((a) => a.n), ["1", "3", "2"]);
  assert.deepEqual(sortApplications([
    app("1", "2026-09-25", "4/5", { nextInterviewAt: "2026-10-02" }),
    app("2", "2026-09-24", "4/5", { nextInterviewAt: "2026-09-28" }),
    app("3", "2026-09-26", "4/5"),
  ], "INTERVIEW").map((a) => a.n), ["2", "1", "3"]);
  assert.deepEqual(sortApplications([
    app("1", "2026-09-25", "4/5", { offerDeadline: "2026-10-02" }),
    app("2", "2026-09-24", "4/5", { offerDeadline: "2026-09-28" }),
    app("3", "2026-09-26", "4/5"),
  ], "OFFER").map((a) => a.n), ["2", "1", "3"]);
});

test("explicit Pipeline URL order survives reload and overrides the stage default", () => {
  const url = new URLSearchParams("tab=EVALUATED&sort=date&dir=1");
  const restored = new URLSearchParams(url.toString());
  assert.equal(applicationOrderFromParams(restored), "date-asc");
  assert.deepEqual(sortApplications([app("1", "2026-09-25", "5/5"), app("2", "2026-09-24", "3/5")], "EVALUATED", applicationOrderFromParams(restored)).map((a) => a.n), ["2", "1"]);
  assert.equal(applicationOrderFromParams(new URLSearchParams("tab=OFFER")), "default");
});

test("Contacts history is newest first; explicit preference survives reload", () => {
  const rows = [
    { date: "2026-09-24", company: "Zeta", name: "Pat", trackerNum: "2" },
    { date: "2026-09-25", company: "Acme", name: "Lee", trackerNum: "1" },
    { date: "", company: "Unknown", name: "Sam", trackerNum: "3" },
  ];
  assert.deepEqual(sortContacts(rows).map((r) => r.company), ["Acme", "Zeta", "Unknown"]);
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  writeSortPreference("contacts", "company", storage);
  assert.equal(readSortPreference("contacts", ["newest", "company"], "newest", storage), "company");
  assert.deepEqual(sortContacts(rows, readSortPreference("contacts", ["newest", "company"], "newest", storage)).map((r) => r.company), ["Acme", "Unknown", "Zeta"]);
});

test("Explore and Inbox rank quality or discovery freshness with deterministic ties", () => {
  const offers = [
    { url: "z", company: "Zeta", title: "Engineer", fitScore: 80, postedAt: "" },
    { url: "b", company: "Beta", title: "Engineer", fitScore: 80, postedAt: "2026-09-25" },
    { url: "a", company: "Alpha", title: "Engineer", fitScore: 80, postedAt: "2026-09-25" },
  ];
  assert.deepEqual(sortOffers(offers).map((o) => o.url), ["a", "b", "z"]);
  assert.deepEqual(sortOffers(offers, "fresh").map((o) => o.url), ["a", "b", "z"]);
  assert.deepEqual(sortInbox(offers.map((o) => ({ ...o, role: o.title }))).map((o) => o.url), ["a", "b", "z"]);
});

test("Today follows urgency, due date, and the next interview or offer deadline", () => {
  const due = [
    { num: 1, urgency: "overdue", nextFollowupDate: "2026-09-24", company: "A" },
    { num: 2, urgency: "urgent", nextFollowupDate: "2026-09-25", company: "B" },
    { num: 3, urgency: "overdue", nextFollowupDate: "2026-09-23", company: "C" },
  ];
  assert.deepEqual(sortFollowups(due).map((r) => r.num), [2, 3, 1]);
  const focus = [
    app("1", "2026-09-25", "4/5", { status: "Interview", nextInterviewAt: "2026-10-03" }),
    app("2", "2026-09-24", "4/5", { status: "Offer", offerDeadline: "2026-09-28" }),
    app("3", "2026-09-26", "4/5", { status: "Interview" }),
  ];
  assert.deepEqual(sortTodayFocus(focus).map((r) => r.n), ["2", "1", "3"]);
});

test("scheduled ledger and explicit offer notes supply the event dates", () => {
  const ledger = [
    "tracker#\tround_no\ttype\taudience\tstatus\tscheduled_at",
    "26\t1\ttechnical\tpeer-tech\tdone\t2026-09-20",
    "26\t2\tfinal\tpanel-mixed\tscheduled\t2026-10-03T15:00",
    "26\t3\tfinal\tpanel-mixed\tscheduled\t2026-09-28",
    "27\t1\ttechnical\tpeer-tech\tscheduled\tunknown",
  ].join("\n");
  assert.equal(scheduledInterviewDates(ledger).get("26"), "2026-09-28");
  assert.equal(scheduledInterviewDates(ledger).has("27"), false);
  assert.equal(offerDeadlineFromNotes("Client call; Decision deadline: 2026-09-30"), "2026-09-30");
  assert.equal(offerDeadlineFromNotes("Offer deadline: 2026-02-30"), undefined);
});
