import assert from "node:assert/strict";
import test from "node:test";
import { acquireWorkerSlot } from "./src/lib/core/worker-admission.ts";

function withLimits(fn) {
  const previous = {
    global: process.env.CAREER_OPS_WORKER_GLOBAL_LIMIT,
    client: process.env.CAREER_OPS_WORKER_CLIENT_LIMIT,
    queue: process.env.CAREER_OPS_WORKER_QUEUE_LIMIT,
  };
  process.env.CAREER_OPS_WORKER_GLOBAL_LIMIT = "1";
  process.env.CAREER_OPS_WORKER_CLIENT_LIMIT = "2";
  process.env.CAREER_OPS_WORKER_QUEUE_LIMIT = "1";
  return Promise.resolve().then(fn).finally(() => {
    if (previous.global === undefined) delete process.env.CAREER_OPS_WORKER_GLOBAL_LIMIT;
    else process.env.CAREER_OPS_WORKER_GLOBAL_LIMIT = previous.global;
    if (previous.client === undefined) delete process.env.CAREER_OPS_WORKER_CLIENT_LIMIT;
    else process.env.CAREER_OPS_WORKER_CLIENT_LIMIT = previous.client;
    if (previous.queue === undefined) delete process.env.CAREER_OPS_WORKER_QUEUE_LIMIT;
    else process.env.CAREER_OPS_WORKER_QUEUE_LIMIT = previous.queue;
  });
}

test("worker admission queues within limits, rejects overflow, and drains FIFO on release", async () => {
  await withLimits(async () => {
    const first = await acquireWorkerSlot("client-a");
    assert.equal(first.accepted, true);

    const secondPromise = acquireWorkerSlot("client-a");
    const overflow = await acquireWorkerSlot("client-a");
    assert.deepEqual(overflow, { accepted: false, reason: "client-limit" });

    first.release();
    const second = await secondPromise;
    assert.equal(second.accepted, true);
    assert.equal(second.queued, true);
    second.release();
  });
});

test("worker admission enforces a global queue cap across clients", async () => {
  await withLimits(async () => {
    const first = await acquireWorkerSlot("client-a");
    const queued = acquireWorkerSlot("client-b");
    const overflow = await acquireWorkerSlot("client-c");
    assert.deepEqual(overflow, { accepted: false, reason: "queue-full" });
    first.release();
    const second = await queued;
    assert.equal(second.accepted, true);
    second.release();
  });
});

test("aborting a queued request removes it without consuming a worker slot", async () => {
  await withLimits(async () => {
    const first = await acquireWorkerSlot("client-a");
    const controller = new AbortController();
    const queued = acquireWorkerSlot("client-b", { signal: controller.signal });
    controller.abort();
    assert.deepEqual(await queued, { accepted: false, reason: "cancelled" });
    first.release();
    const retry = await acquireWorkerSlot("client-c");
    assert.equal(retry.accepted, true);
    retry.release();
  });
});
