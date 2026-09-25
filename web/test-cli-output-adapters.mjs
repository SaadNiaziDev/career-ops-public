import test from "node:test";
import assert from "node:assert/strict";
import { createCliOutputAdapter } from "./src/lib/jobs/cli-output-adapters.mjs";

test("Claude adapter normalizes stream-json events across chunk boundaries and flushes a final line", () => {
  const adapter = createCliOutputAdapter("claude");
  const input = [
    { type: "system", subtype: "init" },
    { type: "stream_event", event: { type: "content_block_start", content_block: { type: "tool_use", name: "Read" } } },
    { type: "stream_event", event: { type: "content_block_delta", delta: { text: "Hello" } } },
    { type: "result", usage: { input_tokens: 2, output_tokens: 3, cache_creation_input_tokens: 4 }, total_cost_usd: 0.12 },
  ].map((event) => JSON.stringify(event)).join("\n");
  const events = [...adapter.push(input.slice(0, 31)), ...adapter.push(input.slice(31)), ...adapter.finish()];
  assert.deepEqual(events, [
    { type: "ready" },
    { type: "tool", name: "Read" },
    { type: "text", text: "Hello" },
    { type: "usage", tokens: 9, costUsd: 0.12 },
  ]);
});

test("Codex adapter ignores setup noise and emits the last agent message and usage", () => {
  const adapter = createCliOutputAdapter("codex");
  const events = [
    ...adapter.push("codex initializing\n{"),
    ...adapter.push('"type":"item.started","item":{"type":"command_execution","command":"node check-liveness.mjs"}}\n'),
    ...adapter.push('{"type":"item.completed","item":{"type":"agent_message","text":"Finished"}}\n'),
    ...adapter.push('{"type":"turn.completed","usage":{"input_tokens":5,"output_tokens":7,"cache_write_input_tokens":2}}'),
    ...adapter.finish(),
  ];
  assert.deepEqual(events, [
    { type: "command", command: "node check-liveness.mjs" },
    { type: "usage", tokens: 14 },
    { type: "final-text", text: "Finished" },
  ]);
});

test("generic CLI adapter preserves arbitrary chunks exactly", () => {
  const adapter = createCliOutputAdapter("cursor");
  assert.deepEqual(adapter.push("one"), [{ type: "text", text: "one" }]);
  assert.deepEqual(adapter.push("\ntwo"), [{ type: "text", text: "\ntwo" }]);
  assert.deepEqual(adapter.finish(), []);
});
