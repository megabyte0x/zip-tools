import assert from "node:assert/strict";
import { test } from "node:test";
import { agentResponse, withRepresentationHeaders } from "./agentSurface.ts";
import { makeZip } from "./test-zip.ts";
import type { ZipIndexFile } from "./types.ts";

const index: ZipIndexFile = { snapshot: { sha: "abc", date: "2026-10-07", url: "https://example.org/source" }, zips: [makeZip({ id: "1", body: "# Abstract\n\nRead the original proposal.", bodyKind: "md", bodyFormat: "markdown" })], nus: [], dangling: [] };
const request = (path: string, headers?: HeadersInit, method = "GET") => new Request(`https://example.com${path}`, { headers, method });

test("homepage negotiates actual Markdown and offers crawlable proposal links", async () => {
  const response = await agentResponse(request("/", { Accept: "text/markdown" }), index);
  assert.equal(response?.status, 200);
  assert.match(response!.headers.get("Content-Type")!, /^text\/markdown/);
  assert.match(response!.headers.get("Vary")!, /accept/i);
  assert.match(await response!.text(), /\[ZIP 1: Example ZIP\]\(https:\/\/example.com\/zip\/1\)/);
  assert.equal(await agentResponse(request("/", { Accept: "text/html" }), index), null);
});

test("rejected Markdown, Next navigation and mutations remain on their normal handlers", async () => {
  const variants: HeadersInit[] = [{ Accept: "text/markdown;q=0" }, { Accept: "text/markdown;q=0.2,text/html;q=1" }, { Accept: "text/markdown", RSC: "1" }];
  for (const headers of variants) {
    assert.equal(await agentResponse(request("/", headers), index), null);
  }
  assert.equal(await agentResponse(request("/", { Accept: "text/markdown" }, "POST"), index), null);
  assert.equal(await agentResponse(request("/api/views", { Accept: "text/markdown" }), index), null);
});

test("proposal Markdown includes its body, provenance and proper missing-page recovery", async () => {
  const response = await agentResponse(request("/zip/1.md"), index);
  const body = await response!.text();
  assert.match(body, /Read the original proposal/);
  assert.match(body, /Snapshot: abc/);
  const missing = await agentResponse(request("/zip/999", { Accept: "text/markdown" }), index);
  assert.equal(missing?.status, 404);
  assert.match(await missing!.text(), /\[Browse proposals\]/);
});

test("sitemap lists real pages and Markdown HEAD returns no body", async () => {
  const sitemap = await agentResponse(request("/sitemap.xml"), index);
  assert.match(await sitemap!.text(), /<loc>https:\/\/example.com\/zip\/1<\/loc>/);
  const head = await agentResponse(request("/zip/1", { Accept: "text/markdown" }, "HEAD"), index);
  assert.equal(head?.status, 200);
  assert.equal(await head!.text(), "");
});

test("HTML and RSC vary by Accept and advertise the alternate representation", () => {
  const response = withRepresentationHeaders(request("/zip/1"), new Response("<html>", { headers: { "Content-Type": "text/html" } }), "/zip/1");
  assert.match(response.headers.get("Vary")!, /accept/i);
  assert.match(response.headers.get("Vary")!, /cookie/i);
  assert.match(response.headers.get("Vary")!, /authorization/i);
  assert.match(response.headers.get("Link")!, /type="text\/markdown"/);
});

test("unknown inherited object names return a recoverable Markdown 404", async () => {
  for (const path of ["/constructor.md", "/toString.md", "/__proto__.md"]) {
    const response = await agentResponse(request(path), index);
    assert.equal(response?.status, 404);
  }
});

test("API discovery routes publish JSON contracts without advertising false Markdown alternatives", async () => {
  const response = await agentResponse(request("/openapi.json"), index);
  assert.equal((await response!.json()).openapi, "3.1.1");
  assert.ok(!response!.headers.get("Link")!.includes('rel="alternate"'));
  const catalog = await agentResponse(request("/.well-known/api-catalog"), index);
  assert.match(catalog!.headers.get("Content-Type")!, /^application\/linkset\+json/);
  assert.equal((await catalog!.json()).linkset[0]["service-desc"][0].href, "https://example.com/openapi.json");
});
