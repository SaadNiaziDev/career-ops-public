import assert from "node:assert/strict";
import test from "node:test";
import { localBrowserUrl } from "../src/lib/apply/browser-url.ts";

test("browser setup permits only local HTTP debug servers", () => {
  assert.equal(localBrowserUrl(" http://127.0.0.1:9222/ "), "http://127.0.0.1:9222");
  assert.equal(localBrowserUrl("http://localhost:9222"), "http://localhost:9222");
  assert.equal(localBrowserUrl("http://[::1]:9222"), "http://[::1]:9222");
  assert.equal(localBrowserUrl(" "), "");
  for (const value of [null, {}, "file:///tmp/chrome", "https://example.com", "http://127.0.0.1.evil.test:9222", "http://user:pass@localhost:9222", "http://localhost:9222/proxy", "http://localhost:9222?redirect=evil", "http://localhost:9222#fragment"]) {
    assert.throws(() => localBrowserUrl(value));
  }
});
