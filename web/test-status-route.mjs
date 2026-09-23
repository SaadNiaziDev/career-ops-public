import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createIsolatedNextProject } from "./test-support/isolated-next-project.mjs";

const WEB = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(WEB, "..");
const SESSION = "status-route-test-session";

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("status API updates a tracker through the compiled route", { skip: process.platform === "win32", timeout: 90_000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(WEB, ".status-route-test-"));
  const tracker = path.join(temp, "applications.md");
  const project = createIsolatedNextProject(WEB, temp);
  const port = await unusedPort();
  fs.writeFileSync(tracker, [
    "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |",
    "|---|---|---|---|---|---|---|---|---|",
    "| 1 | 2026-01-01 | Example Co | Engineer | 4/5 | Evaluated | — | — | — |",
    "",
  ].join("\n"));

  const server = spawn(process.execPath, [path.join(WEB, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: project,
    env: {
      ...process.env,
      CAREER_OPS_SESSION_TOKEN: SESSION,
      CAREER_OPS_ROOT: ROOT,
      CAREER_OPS_TRACKER: tracker,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-8_000); });
  server.stderr.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-8_000); });
  t.after(async () => {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      delay(3_000).then(() => server.kill("SIGKILL")),
    ]);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  const origin = `http://localhost:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`web server exited early (${server.exitCode}): ${serverOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/version`, { headers: { cookie: `career_ops_session=${SESSION}` } });
      if (response.ok) { ready = true; break; }
    } catch { /* starting */ }
    await delay(250);
  }
  assert.ok(ready, "web server should start");

  const response = await fetch(`${origin}/api/status`, {
    method: "POST",
    headers: {
      host: `localhost:${port}`,
      cookie: `career_ops_session=${SESSION}`,
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
    },
    body: JSON.stringify({ n: "1", status: "Applied" }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.status, "Applied");
  assert.match(fs.readFileSync(tracker, "utf8"), /\| 1 \| 2026-01-01 \| Example Co \| Engineer \| 4\/5 \| Applied \|/);
});
