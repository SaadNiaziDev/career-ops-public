import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fetchPublicUrl, installPublicUrlPolicy, isPublicAddress, validatePublicUrl } from "./src/lib/public-url-policy.ts";
import { startPublicUrlProxy } from "../public-url-policy.mjs";

const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];

test("allows public IPv4, IPv6, and hostnames", async () => {
  for (const address of ["8.8.8.8", "2606:4700:4700::1111"])
    assert.equal(isPublicAddress(address), true, address);
  assert.equal((await validatePublicUrl("https://example.com/jobs/1", { lookup: publicDns })).hostname, "example.com");
});

test("rejects local, private, reserved, and encoded IP destinations", async () => {
  for (const url of [
    "http://localhost/", "http://service.local/", "http://127.0.0.1/", "http://2130706433/",
    "http://0x7f000001/", "http://10.1.2.3/", "http://172.20.1.1/", "http://192.168.1.2/",
    "http://169.254.169.254/", "http://[::1]/", "http://[fe80::1]/", "http://[fd00::1]/",
    "http://[::ffff:7f00:1]/", "http://[2001:db8::1]/", "http://[ff02::1]/",
  ]) await assert.rejects(validatePublicUrl(url), undefined, url);
  assert.equal(isPublicAddress("192.168.1.2"), false);
  assert.equal(isPublicAddress("2001:db8::1"), false);
});

test("rejects credentials, non-HTTP schemes, and any private DNS answer", async () => {
  await assert.rejects(validatePublicUrl("https://user:pass@example.com/", { lookup: publicDns }));
  await assert.rejects(validatePublicUrl("file:///etc/passwd"));
  await assert.rejects(validatePublicUrl("https://mixed.example/", {
    lookup: async () => [{ address: "93.184.216.34" }, { address: "10.0.0.4" }],
  }));
});

test("redirects to private destinations are rejected before the next request", async () => {
  let requests = 0;
  await assert.rejects(fetchPublicUrl("https://example.com/start", {}, {
    lookup: publicDns,
    fetcher: async () => {
      requests++;
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    },
  }));
  assert.equal(requests, 1);
});

test("rechecks DNS on redirects to detect a rebinding answer", async () => {
  let lookups = 0;
  let requests = 0;
  await assert.rejects(fetchPublicUrl("https://example.com/start", {}, {
    lookup: async () => [{ address: ++lookups === 1 ? "93.184.216.34" : "127.0.0.1" }],
    fetcher: async () => {
      requests++;
      return new Response(null, { status: 302, headers: { location: "/next" } });
    },
  }));
  assert.equal(lookups, 2);
  assert.equal(requests, 1);
});

test("browser policy blocks redirected/private requests and continues public ones", async () => {
  let handler;
  const context = { route: async (_pattern, callback) => { handler = callback; } };
  await installPublicUrlPolicy(context, { lookup: publicDns });

  const run = async (url) => {
    const outcome = { continued: false, aborted: false };
    await handler({
      request: () => ({ url: () => url }),
      continue: async () => { outcome.continued = true; },
      abort: async () => { outcome.aborted = true; },
    });
    return outcome;
  };

  assert.deepEqual(await run("https://example.com/job"), { continued: true, aborted: false });
  assert.deepEqual(await run("http://127.0.0.1/redirect"), { continued: false, aborted: true });
});

test("pinned browser proxy rejects encoded loopback destinations", async (t) => {
  const proxy = await startPublicUrlProxy();
  t.after(() => proxy.close());
  const port = Number(new URL(proxy.server).port);
  const response = await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: "http://2130706433/admin",
      method: "GET",
    }, resolve);
    request.on("error", reject);
    request.end();
  });
  assert.equal(response.statusCode, 403);
});
