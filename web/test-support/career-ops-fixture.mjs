import fs from "node:fs";
import path from "node:path";

/** Minimal independent user home; tests never write to the real tracker or history. */
export function createCareerOpsFixture(repoRoot, root) {
  for (const dir of ["data", "reports", "config", "modes", "templates"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const name of ["tracker-mutations.mjs", "tracker-utils.mjs", "tracker-parse.mjs", "tracker-aliases.json"]) fs.symlinkSync(path.join(repoRoot, name), path.join(root, name));
  fs.copyFileSync(path.join(repoRoot, "templates/states.yml"), path.join(root, "templates/states.yml"));
  fs.writeFileSync(path.join(root, "cv.md"), "# UI Test Candidate\n\n## Experience\n\nSoftware engineer for interface tests.\n");
  fs.writeFileSync(path.join(root, "config/profile.yml"), "candidate:\n  full_name: UI Test Candidate\n  email: test@example.com\nlanguage:\n  output: en\n");
  fs.writeFileSync(path.join(root, "modes/_profile.md"), "# Test targeting\nSoftware engineering.\n");
  fs.writeFileSync(path.join(root, "portals.yml"), "companies: []\n");
  fs.writeFileSync(path.join(root, "data/applications.md"), [
    "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |",
    "|---|---|---|---|---|---|---|---|---|",
    "| 1 | 2026-01-01 | Example Co | Engineer | 4.4/5 | Evaluated | — | [1](reports/1-example.md) | — |",
    "| 2 | 2026-01-02 | Legacy Co | Engineer | 4.1/5 | Applied | — | — | — |",
    "| 3 | 2026-01-03 | Low Score Co | Engineer | 3.6/5 | Evaluated | — | — | — |",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "reports/1-example.md"), "# Example Co — Engineer\n\n**URL:** https://example.com/jobs/engineer\n**Legitimacy:** verified\n**Score:** 4.4/5\n\n## A. Role\n\nTest role.\n");
  return root;
}
