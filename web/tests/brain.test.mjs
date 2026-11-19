import test from "node:test";
import assert from "node:assert/strict";
import { classifyProofUrl, detectStyle, githubHandle, parseCvRoles, sharpness, voiceDnaMarkdown } from "../src/lib/brain-shared.ts";

test("cv roles parse both heading styles", () => {
  const piped = "## EXPERIENCE\n\n### Engineer | Acme | Lahore | Jan 2022 – Present\n\n## SKILLS\n### Go";
  assert.deepEqual(parseCvRoles(piped), [{ title: "Engineer", company: "Acme", dates: "Jan 2022 – Present" }]);
  const classic = "## Work Experience\n\n### Acme -- Remote\n\n**Senior Engineer**\n2020-2024\n";
  assert.deepEqual(parseCvRoles(classic), [{ title: "Senior Engineer", company: "Acme", dates: "2020-2024" }]);
});

test("style detection is deterministic and style-only", () => {
  const s = detectStyle(["Hey Sam, quick one. I shipped the offline mode last week and it's held up well. Could we talk Thursday?\n\nCheers,\nSaad"]);
  assert.ok(s);
  assert.equal(s.capitals, "proper");
  assert.equal(s.exclamations, 0);
  assert.equal(s.signOff, "Cheers");
  assert.ok(s.chips.includes("no exclamation marks"));
  const dna = voiceDnaMarkdown(s, 1);
  assert.ok(!dna.includes("offline"), "voice-dna must not quote sample content");
  assert.equal(detectStyle([""]), null);
});

test("urls classify and github handles normalise", () => {
  assert.equal(classifyProofUrl("https://github.com/a"), "github");
  assert.equal(classifyProofUrl("https://github.com/a/b"), "repo");
  assert.equal(classifyProofUrl("https://www.loom.com/share/x"), "loom");
  assert.equal(githubHandle("github.com/SaadNiaziDev"), "SaadNiaziDev");
  assert.equal(githubHandle("https://github.com/x/y"), "x");
  assert.equal(githubHandle("not a handle!"), "");
});

test("sharpness adds up to 100 and hints sort by value", () => {
  const empty = { proofs: [], githubHandle: "", status: [], x: "", site: "", calendarLink: "", tone: "", neverSay: [], sampleCount: 0, cvWords: 0, notes: "" };
  assert.equal(sharpness(empty).percent, 0);
  assert.equal(sharpness(empty).hints[0].points, 20);
  const full = { proofs: [{ kind: "repo", url: "https://a.b", starred: true }, { kind: "other", url: "https://c.d" }, { kind: "other", url: "https://e.f" }], githubHandle: "x", status: ["building"], x: "@x", site: "", calendarLink: "https://cal.com/x", tone: "spicy", neverSay: ["synergy"], sampleCount: 1, cvWords: 500, notes: "Mention I'm free to start in December." };
  assert.equal(sharpness(full).percent, 100);
  assert.equal(sharpness(full).sections.proof, 100);
});
