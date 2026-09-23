import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEscape } from "./src/lib/csv.ts";

test("formula-leading text stays text after CSV quoting", () => {
  const prefixes = ["=", "+", "-", "@"];
  const leadingWhitespace = ["", " \t", "\u00a0", "\u0000\u2003"];

  for (const prefix of prefixes) {
    for (const leading of leadingWhitespace) {
      const value = `${leading}${prefix}SUM(1, \"x\")\r\n雪`;
      const safeValue = `'${value}`;
      const expected = `"${safeValue.replace(/"/g, '""')}"`;
      assert.equal(csvEscape(value), expected, `prefix ${JSON.stringify(leading + prefix)}`);
    }
  }
});

test("leading controls and Unicode whitespace cannot hide a formula", () => {
  for (const value of ["\t+SUM(A1:A2)", "\u0001@HYPERLINK(\"x\")", "\u2007=1+1", "\ufeff-CMD"]) {
    const escaped = csvEscape(value);
    assert.ok(escaped.startsWith("'") || escaped.startsWith("\"'"), JSON.stringify(value));
  }
});

test("ordinary text, numbers, and ISO dates remain unchanged", () => {
  for (const value of ["Acme Inc.", "Engineer", "Applied", "-42", "+1.25", "  -12.5 ", "2026-09-23"])
    assert.equal(csvEscape(value), value);
  assert.equal(csvEscape("Acme, Inc."), '"Acme, Inc."');
});

test("quotes and CRLF are escaped for ordinary CSV text", () => {
  assert.equal(csvEscape('A "quoted"\r\ncompany'), '"A ""quoted""\r\ncompany"');
});
