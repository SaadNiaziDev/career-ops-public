import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createIsolatedNextProject } from "./test-support/isolated-next-project.mjs";

const WEB = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(WEB, "..");
const SESSION = "worker-limits-test-session";

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`web server exited early (${child.exitCode})`);
    try {
      const response = await fetch(url, { headers: { cookie: `career_ops_session=${SESSION}` } });
      if (response.ok) return;
    } catch { /* starting */ }
    await delay(250);
  }
  throw new Error("web server did not become ready");
}

test("API limits oversized uploads and worker requests, and cancellation kills its child", { skip: process.platform === "win32", timeout: 120_000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(WEB, ".worker-limits-test-"));
  const project = createIsolatedNextProject(WEB, temp);
  const binDir = path.join(temp, "bin");
  const port = await unusedPort();
  fs.mkdirSync(binDir);
  const cliPath = path.join(binDir, "codex");
  fs.writeFileSync(cliPath, `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'PID=' + process.pid } }) + '\\n');\nsetInterval(() => {}, 1000);\n`);
  fs.chmodSync(cliPath, 0o755);

  const child = spawn(process.execPath, [path.join(WEB, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: project,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
      TMPDIR: temp,
      CAREER_OPS_SESSION_TOKEN: SESSION,
      CAREER_OPS_ROOT: ROOT,
      OPENAI_API_KEY: "worker-limits-test-key",
      CAREER_OPS_WORKER_GLOBAL_LIMIT: "1",
      CAREER_OPS_WORKER_CLIENT_LIMIT: "1",
      CAREER_OPS_WORKER_QUEUE_LIMIT: "2",
    },
    stdio: "ignore",
  });
  t.after(async () => {
    const processes = spawnSync("pgrep", ["-f", cliPath], { encoding: "utf8" });
    if (processes.status === 0) {
      for (const pid of processes.stdout.trim().split(/\s+/).map(Number)) {
        if (pid && pid !== process.pid) try { process.kill(pid, "SIGKILL"); } catch { /* already exited */ }
      }
    }
    child.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3_000).then(() => child.kill("SIGKILL"))]);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  const origin = `http://localhost:${port}`;
  await waitForServer(`http://127.0.0.1:${port}/api/version`, child);
  const headers = {
    host: `localhost:${port}`,
    cookie: `career_ops_session=${SESSION}`,
    origin,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  };

  const upload = new FormData();
  upload.append("file", new Blob(["x".repeat(5_300_000)], { type: "text/plain" }), "large.txt");
  const uploadResponse = await fetch(`${origin}/api/cv/ingest`, { method: "POST", headers: { cookie: headers.cookie, origin, "sec-fetch-site": "same-origin" }, body: upload });
  assert.equal(uploadResponse.status, 413, "oversized multipart body must be rejected before parsing the upload");

  const oversizedRun = await fetch(`${origin}/api/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "research", input: "x".repeat(1_100_000), cliId: "codex", runId: "job-too-large" }),
  });
  assert.equal(oversizedRun.status, 413, "oversized worker request must be rejected before JSON parsing");

  const oversizedAnswer = await fetch(`${origin}/api/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "interview-practice", input: "52", cliId: "codex", runId: "job-answer-too-large", context: { answers: ["x".repeat(12_001)] } }),
  });
  assert.equal(oversizedAnswer.status, 413, "oversized interview answers must be rejected before prompt creation");

  const startController = new AbortController();
  const startPromise = fetch(`${origin}/api/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "research", input: "one", cliId: "codex", runId: "job-real-worker-one" }),
    signal: startController.signal,
  });
  const findWorkerPids = () => {
    const result = spawnSync("pgrep", ["-f", cliPath], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim().split(/\s+/).map(Number).filter((pid) => Number.isInteger(pid) && pid !== process.pid) : [];
  };
  let workerPids = [];
  for (let attempt = 0; attempt < 80 && workerPids.length === 0; attempt++) {
    await delay(100);
    workerPids = findWorkerPids();
  }
  assert.ok(workerPids.length > 0, "the route should have launched the real CLI subprocess");

  const overloaded = await fetch(`${origin}/api/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "research", input: "two", cliId: "codex", runId: "job-real-worker-two" }),
  });
  assert.equal(overloaded.status, 429, "a client over its running/queue cap receives actionable back-pressure");
  const overloadBody = await overloaded.json();
  assert.match(overloadBody.error, /worker|queue|retry/i);

  startController.abort();
  await startPromise.catch(() => {});
  for (let attempt = 0; attempt < 60; attempt++) {
    if (workerPids.some((pid) => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    })) await delay(50);
    else break;
  }
  for (const pid of workerPids) assert.throws(() => process.kill(pid, 0), "disconnecting the API stream must terminate its OS child");
});
