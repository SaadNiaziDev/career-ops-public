import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { isIP } from "node:net";

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/start-local.mjs <dev|start>");
  process.exit(2);
}

const bindHost = (process.env.CAREER_OPS_HOST || "127.0.0.1").trim();
const loopback = bindHost === "localhost" || bindHost === "127.0.0.1" || bindHost === "::1";
if (!loopback && process.env.CAREER_OPS_ALLOW_REMOTE !== "1") {
  console.error("Remote binding is disabled. Set CAREER_OPS_ALLOW_REMOTE=1 to opt in.");
  process.exit(2);
}
if (!loopback && !process.env.CAREER_OPS_ALLOWED_HOSTS?.trim()) {
  console.error("Remote binding requires CAREER_OPS_ALLOWED_HOSTS with exact hostnames or IPs.");
  process.exit(2);
}
if (!bindHost || /[\s/\\]/.test(bindHost) || (!isIP(bindHost) && !/^[a-z0-9.-]+$/i.test(bindHost))) {
  console.error("CAREER_OPS_HOST must be a hostname or IP address.");
  process.exit(2);
}

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextCli, mode, "--hostname", bindHost], {
  stdio: "inherit",
  env: {
    ...process.env,
    CAREER_OPS_SESSION_TOKEN: randomBytes(32).toString("hex"),
  },
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(`Could not start Next.js: ${error.message}`);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
