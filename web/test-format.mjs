import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMachineSummary } from "./src/lib/format.ts";

test("machine summary parses every inline dimension and empty evidence lists", () => {
  const md = `## Machine Summary

\`\`\`yaml
scores: {match: 4.4, north_star: 4.1, comp: 3.8, culture: 4.0, red_flags: 3.5, global: 4.2}
hard_stops: []
confidence: "Medium"
advertised_comp: null
\`\`\``;

  const summary = parseMachineSummary(md);
  assert.deepEqual(summary?.scores, {
    match: 4.4,
    north_star: 4.1,
    comp: 3.8,
    culture: 4,
    red_flags: 3.5,
    global: 4.2,
  });
  assert.deepEqual(summary?.hard_stops, []);
  assert.equal(summary?.confidence, "Medium");
  assert.equal(summary?.advertised_comp, "");
});
