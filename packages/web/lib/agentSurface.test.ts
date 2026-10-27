import assert from "node:assert/strict";
import { test } from "node:test";
import { agentResponse, withRepresentationHeaders } from "./agentSurface.ts";
import { makeZip } from "./test-zip.ts";
import type { ZipIndexFile } from "./types.ts";

const index: ZipIndexFile = { snapshot: { sha: "abc", date: "2026-10-07", url: "https://example.org/source" }, zips: [makeZip({ id: "1", body: "# Abstract\n\nRead the original proposal.", bodyKind: "md", bodyFormat: "markdown" })], nus: [], dangling: [] };
const request = (path: string, headers?: HeadersInit, method = "GET") => new Request(`https://example.com${path}`, { headers, method });
const respond = (req: Request, parts: string[] = []) => agentResponse(req, index, parts);

test("homepage negotiates actual Markdown and offers crawlable proposal links", async () => {
  const response = await respond(request("/", { Accept: "text/markdown" }));
  assert.equal(response?.status, 200);
  assert.match(response!.headers.get("Content-Type")!, /^text\/markdown/);
  assert.match(response!.headers.get("Vary")!, /accept/i);
  assert.match(await response!.text(), /\[ZIP 1: Example ZIP\]\(https:\/\/example.com\/zip\/1\)/);
  assert.equal(await respond(request("/", { Accept: "text/html" })), null);
});

test("rejected Markdown, Next navigation and mutations remain on their normal handlers", async () => {
  const variants: HeadersInit[] = [{ Accept: "text/markdown;q=0" }, { Accept: "text/markdown;q=0.2,text/html;q=1" }, { Accept: "text/markdown", RSC: "1" }];
  for (const headers of variants) {
    assert.equal(await respond(request("/", headers)), null);
  }
  assert.equal(await respond(request("/", { Accept: "text/markdown" }, "POST")), null);
  assert.equal(await respond(request("/api/views", { Accept: "text/markdown" })), null);
});

test("proposal Markdown includes its body, provenance and proper missing-page recovery", async () => {
  const response = await respond(request("/zip/1.md"));
  const body = await response!.text();
  assert.match(body, /Read the original proposal/);
  assert.match(body, /Snapshot: abc/);
  const missing = await respond(request("/zip/999", { Accept: "text/markdown" }));
  assert.equal(missing?.status, 404);
  assert.match(await missing!.text(), /\[Browse proposals\]/);
});

test("sitemap lists real pages and Markdown HEAD returns no body", async () => {
  const sitemap = await respond(request("/sitemap.xml"), ["/zip/1?part=2"]);
  const xml = await sitemap!.text();
  assert.match(xml, /<loc>https:\/\/example.com\/zip\/1<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example.com\/zip\/1\?part=2<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example.com\/zips\?kind=draft<\/loc>/);
  assert.ok(!xml.includes("/list</loc>"));
  const head = await respond(request("/zip/1", { Accept: "text/markdown" }, "HEAD"));
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
    const response = await respond(request(path));
    assert.equal(response?.status, 404);
  }
});

test("API discovery routes publish JSON contracts without advertising false Markdown alternatives", async () => {
  const response = await respond(request("/openapi.json"));
  assert.equal((await response!.json()).openapi, "3.1.1");
  assert.ok(!response!.headers.get("Link")!.includes('rel="alternate"'));
  const catalog = await respond(request("/.well-known/api-catalog"));
  assert.match(catalog!.headers.get("Content-Type")!, /^application\/linkset\+json/);
  assert.equal((await catalog!.json()).linkset[0]["service-desc"][0].href, "https://example.com/openapi.json");
});
