import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentArgs, extractJson, runAgent } from "../src/lib/agent.ts";
import { validateEvaluation, saveEvaluation, evaluationForUrl } from "../src/lib/evaluations.ts";
import { db } from "../src/lib/db.ts";

test("agents get no local tools; only web tasks get web search", () => {
  const claude = agentArgs("claude", "hi");
  assert.equal(claude[claude.indexOf("--tools") + 1], "");
  for (const flag of ["--restricted", "--strict-mcp-config"]) assert.ok(claude.includes(flag));
  assert.ok(!claude.includes("--allowedTools"));
  const claudeWeb = agentArgs("claude", "hi", true);
  assert.equal(claudeWeb[claudeWeb.indexOf("--tools") + 1], "WebSearch,WebFetch");
  const codex = agentArgs("codex", "hi");
  assert.equal(codex[codex.indexOf("--sandbox") + 1], "read-only");
  assert.ok(!codex.includes("--search"));
  assert.ok(agentArgs("codex", "hi", true).includes("--search"));
  assert.equal(codex.at(-1), "hi");
  assert.throws(() => agentArgs("cursor", "hi"), /Unsupported/);
});

test("extractJson takes the last fenced block and falls back to a bare object", () => {
  assert.deepEqual(extractJson('a ```json\n{"a":1}\n``` b ```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(extractJson('Here: {"ok":true} done'), { ok: true });
  assert.throws(() => extractJson("no json here"), /valid JSON/);
});

function fakeCli(t, name, script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-cli-"));
  fs.writeFileSync(path.join(dir, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  const prev = process.env.PATH;
  process.env.PATH = `${dir}:${prev}`;
  t.after(() => { process.env.PATH = prev; fs.rmSync(dir, { recursive: true, force: true }); });
}

test("runAgent streams Claude text and returns the final result", async (t) => {
  fakeCli(t, "claude", `echo '{"type":"system","subtype":"init"}'
echo '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"text":"par"}}}'
echo '{"type":"result","is_error":false,"result":"final answer","usage":{"input_tokens":3,"output_tokens":4},"total_cost_usd":0.01}'`);
  const events = [];
  const out = await runAgent({ cliId: "claude", prompt: "x", onEvent: (e) => events.push(e) });
  assert.equal(out.text, "final answer");
  assert.equal(out.tokens, 7);
  assert.ok(events.some((e) => e.type === "text" && e.text === "par"));
});

test("runAgent surfaces Codex errors such as usage limits", async (t) => {
  fakeCli(t, "codex", `echo '{"type":"thread.started"}'
echo '{"type":"error","message":"You hit your usage limit."}'
exit 1`);
  await assert.rejects(runAgent({ cliId: "codex", prompt: "x" }), /usage limit/);
});

test("evaluations are validated, numbered, saved with a report, and deduped by URL", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "career-eval-"));
  process.env.CAREER_OPS_ROOT = root;
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => validateEvaluation({ company: "A", role: "B" }), /score/);
  const e = validateEvaluation({ company: "Acme", role: "Engineer", score: 4.26, scores: { match: 9 }, final_decision: "Apply", sections: { cv_match: "| req | cv |" }, keywords: ["react"] });
  assert.equal(e.score, 4.3);
  assert.equal(e.scores.match, 5);
  const url = "https://jobs.example.com/acme/1";
  const n = saveEvaluation(e, url, "test");
  assert.equal(n, "1");
  const row = db().prepare("SELECT status, score, report FROM applications WHERE n = 1").get();
  assert.deepEqual({ ...row }, { status: "Evaluated", score: "4.3/5", report: "[1]" });
  const report = db().prepare("SELECT content FROM reports WHERE n = 1").get().content;
  assert.match(report, /## Machine Summary\n\n```yaml/);
  assert.match(report, /## B\) Match with CV\n\n\| req \| cv \|/);
  assert.equal(evaluationForUrl(url), "1");
  assert.equal(saveEvaluation(e, "https://jobs.example.com/acme/2", "test"), "2");
});
