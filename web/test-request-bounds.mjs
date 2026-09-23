import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedBody, RequestTooLargeError } from "./src/lib/core/request-bounds.ts";

test("chunked bodies are stopped once their byte ceiling is crossed", async () => {
  let cancelled = false;
  const request = new Request("http://localhost/api/run", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("1234"));
        controller.enqueue(new TextEncoder().encode("5678"));
      },
      cancel() { cancelled = true; },
    }),
    // Node requires this for streamed request bodies; the body has no length header.
    duplex: "half",
  });
  await assert.rejects(readBoundedBody(request, 6), RequestTooLargeError);
  assert.equal(cancelled, true);
});

test("bounded body reads preserve valid bytes exactly", async () => {
  const source = new TextEncoder().encode("safe body");
  const request = new Request("http://localhost/api/run", { method: "POST", body: source });
  assert.equal((await readBoundedBody(request, 32)).toString("utf8"), "safe body");
});
