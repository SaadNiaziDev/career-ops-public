import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeVacancyUrl } from "./src/lib/vacancy-identity.ts";

test("web vacancy identity matches canonical ATS examples", () => {
  assert.equal(
    normalizeVacancyUrl("https://job-boards.greenhouse.io/acme/jobs/12345?gh_jid=12345&utm_source=linkedin#app"),
    "boards.greenhouse.io/acme/jobs/12345",
  );
  assert.equal(
    normalizeVacancyUrl("https://jobs.ashbyhq.com/Acme/abc-123/application"),
    "jobs.ashbyhq.com/acme/abc-123",
  );
});
