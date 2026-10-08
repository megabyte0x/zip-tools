import assert from "node:assert/strict";
import { test } from "node:test";
import { cachePublicPage } from "./publicPageCache.ts";

function check(path: string, init?: RequestInit, status = 200, headers: HeadersInit = {}) {
  return cachePublicPage(new Request(`https://example.com${path}`, init), new Response("content", {
    status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", ...headers },
  }));
}

test("public pages cache with a shorter homepage TTL and preserve query variants", () => {
  for (const path of ["/zips?kind=draft", "/graph", "/list", "/zip/303", "/draft/draft-example", "/nu/nu6.3"]) {
    assert.equal(check(path).headers.get("Cache-Control"), "public, max-age=60, s-maxage=3600, stale-while-revalidate=300");
  }
  assert.equal(check("/").headers.get("Cache-Control"), "public, max-age=60, s-maxage=300, stale-while-revalidate=300");
});

test("RSC navigation and HTML are separate cache variants", async () => {
  const res = check("/zip/303?_rsc=abc", { headers: { RSC: "1" } }, 200, { "Content-Type": "text/x-component", "Vary": "RSC, Next-Router-State-Tree" });
  assert.match(res.headers.get("Cache-Control")!, /s-maxage=3600/);
  for (const name of ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "cookie", "authorization"]) {
    assert.ok(res.headers.get("Vary")!.split(", ").includes(name));
  }
  assert.equal(await res.text(), "content");
});

test("cookies, authorization, actions, writes and errors are never made public", () => {
  for (const headers of [{ Cookie: "preview=1" }, { Authorization: "Bearer private" }, { "Next-Action": "action" }]) {
    const res = check("/zip/303", { headers });
    assert.equal(res.headers.get("Cache-Control"), "private, no-store");
    assert.match(res.headers.get("Vary")!, /cookie/);
  }
  assert.equal(check("/zip/303", { method: "POST" }).headers.get("Cache-Control"), "private, no-store");
  for (const status of [404, 500]) assert.equal(check("/zip/303", undefined, status).headers.get("Cache-Control"), "private, no-store");
  assert.equal(check("/zip/303", undefined, 200, { "Set-Cookie": "session=1" }).headers.get("Cache-Control"), "private, no-store");
});

test("APIs, assets, unknown routes and non-page payloads retain original caching", () => {
  for (const path of ["/api/views", "/api/trending", "/api/summary/303", "/_next/static/test.js", "/unknown", "/zip/303/extra"]) {
    assert.equal(check(path).headers.get("Cache-Control"), "private, no-store");
  }
  assert.equal(check("/zip/303", undefined, 200, { "Content-Type": "application/json" }).headers.get("Cache-Control"), "private, no-store");
});


test("APIs without cache headers opt out of Cloudflare heuristic caching", () => {
  for (const path of ["/api/trending", "/api/views", "/unknown"]) {
    const res = cachePublicPage(new Request(`https://example.com${path}`), new Response("{}", { headers: { "Content-Type": "application/json" } }));
    assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  }
});
