import test from "node:test";
import assert from "node:assert/strict";
import { cleanCvPayload } from "../src/lib/cv/clean-payload.ts";

const base = () => ({
  contract_version: "1.0", lang: "en",
  candidate: { name: "Jane Doe", headline: "Senior Engineer", phone: "", linkedin: { url: "", display: "" } },
  summary: "Builds web apps.",
  experience: [{ company: "Acme", role: "Engineer", dates: "2022 - Present", bullets: ["Shipped X", ""] }, { company: "", role: "", bullets: [] }],
  projects: [1, 2, 3, 4, 5].map((i) => ({ name: `P${i}`, tech: "", bullets: [] })),
  open_source: [{ project: "", role: "Contributor" }],
  awards: [{ title: "", year: "" }],
  certifications: [],
  education: [{ title: "BS Computer Science", org: "University", year: "2022" }],
  skills: [{ category: "Languages", items: "TypeScript" }, { category: "", items: "" }],
});

test("placeholder entries and empty sections are removed before rendering", () => {
  const { payload, problems } = cleanCvPayload(base());
  assert.deepEqual(problems, []);
  assert.equal(payload.open_source, undefined, "Contributor with no project is dropped");
  assert.equal(payload.awards, undefined);
  assert.equal(payload.certifications, undefined);
  assert.equal(payload.experience.length, 1);
  assert.deepEqual(payload.experience[0].bullets, ["Shipped X"]);
  assert.equal(payload.skills.length, 1);
  assert.equal(payload.projects.length, 4, "the renderer accepts at most 4 projects");
  assert.equal(payload.candidate.phone, undefined);
  assert.equal(payload.candidate.linkedin, undefined, "empty link objects are dropped");
});

test("an incomplete CV is reported instead of rendered", () => {
  const { problems } = cleanCvPayload({ ...base(), summary: " ", experience: [{ company: "", role: "" }] });
  assert.deepEqual(problems, ["missing a summary", "no work experience"]);
});
