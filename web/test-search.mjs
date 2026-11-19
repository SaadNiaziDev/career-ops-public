import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectAts } from "./src/lib/search/sources.ts";
import { buildFilter, saveHits } from "./src/lib/search/scan.ts";
import { addJob, listJobs, setDismissed } from "./src/lib/search/jobs.ts";

test("careers URLs map to supported job feeds", () => {
  assert.deepEqual(detectAts("https://boards.greenhouse.io/anthropic"), { ats: "greenhouse", slug: "anthropic" });
  assert.deepEqual(detectAts("https://job-boards.greenhouse.io/embed/job_board?for=stripe"), { ats: "greenhouse", slug: "stripe" });
  assert.deepEqual(detectAts("https://jobs.lever.co/ninjavan"), { ats: "lever", slug: "ninjavan" });
  assert.deepEqual(detectAts("https://jobs.ashbyhq.com/openai/123"), { ats: "ashby", slug: "openai" });
  assert.deepEqual(detectAts("https://apply.workable.com/pavago/"), { ats: "workable", slug: "pavago" });
  assert.equal(detectAts("https://apply.workable.com/j/ABC123"), null);
  assert.deepEqual(detectAts("https://strategic-systems-international.breezy.hr/"), { ats: "breezy", slug: "strategic-systems-international" });
  assert.deepEqual(detectAts("https://careers.smartrecruiters.com/Wise"), { ats: "smartrecruiters", slug: "Wise" });
  assert.equal(detectAts("https://www.deel.com/careers"), null);
});

test("filters follow portals.yml title, location, age and content rules", () => {
  const now = Date.parse("2026-11-19T00:00:00Z");
  const keep = buildFilter({
    title_filter: { positive: ["Software Engineer", "React"], negative: ["intern"] },
    location_filter: { always_allow: ["Pakistan"], allow: ["Remote", "Worldwide", "Lahore"], block: ["India", "US only"] },
    content_filter: { negative: ["must be located in the united states"] },
    max_posting_age_days: 30,
  }, now);
  const hit = (o) => ({ url: "https://x", company: "C", title: "Senior Software Engineer", location: "Remote", ...o });
  assert.equal(keep(hit()), true);
  assert.equal(keep(hit({ title: "Software Engineer Intern" })), false);
  assert.equal(keep(hit({ title: "Product Manager" })), false);
  assert.equal(keep(hit({ location: "Bangalore, India" })), false);
  assert.equal(keep(hit({ location: "Remote - US" })), false, "remote tied to another country is not open to the user");
  assert.equal(keep(hit({ location: "Remote (Worldwide)" })), true);
  assert.equal(keep(hit({ location: "India · Pakistan · Remote" })), true, "always_allow wins over block");
  assert.equal(keep(hit({ location: "Lahore, Punjab" })), true);
  assert.equal(keep(hit({ location: "" })), true, "unknown location passes");
  assert.equal(keep(hit({ postedAt: now - 40 * 86_400_000 })), false);
  assert.equal(keep(hit({ description: "You must be located in the United States." })), false);
});

test("scan results enter the inbox once; dismissed and AI-found jobs behave", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "career-search-"));
  process.env.CAREER_OPS_ROOT = root;
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hits = [{ url: "https://jobs.lever.co/acme/1", company: "Acme", title: "Engineer", location: "Remote", source: "Lever" }];
  assert.equal(saveHits(hits), 1);
  assert.equal(saveHits(hits), 0, "seen postings never come back");
  const [job] = listJobs();
  assert.equal(job.status, "new");
  setDismissed(job.key, true);
  assert.equal(listJobs()[0].status, "dismissed");
  assert.equal(saveHits(hits), 0, "dismissed postings stay dismissed");
  assert.equal(addJob({ url: "https://example.com/careers/2", company: "Beta", role: "Dev", source: "AI search", why: "React + remote" }), true);
  assert.equal(addJob({ url: "https://example.com/careers/2", company: "Beta", role: "Dev", source: "AI search" }), false);
  assert.equal(listJobs().find((j) => j.company === "Beta").why, "React + remote");
});
