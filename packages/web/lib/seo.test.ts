import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalRedirect } from "./seo.ts";
import { pageMetadata } from "./pageMetadata.ts";
import { withRepresentationHeaders } from "./agentSurface.ts";

test("crawler headers and HTML metadata agree without excluding public listings or proposals", () => {
  const cases: Array<[string, string, boolean]> = [
    ["/list", "/list", true],
    ["/zips?q=wallet&page=2", "/zips", true],
    ["/zips?status=Draft", "/zips", true],
    ["/zips?kind=draft&q=wallet", "/zips?kind=draft", true],
    ["/zips?page=2", "/zips", true],
    ["/zips", "/zips", false],
    ["/zips?kind=draft", "/zips?kind=draft", false],
    ["/zips?kind=%64raft", "/zips?kind=draft", false],
    ["/zips?kind=draft&kind=draft", "/zips?kind=draft", true],
    ["/zip/32?part=2", "/zip/32?part=2", false],
    ["/draft/draft-example", "/draft/draft-example", false],
  ];
  for (const [path, canonical, noindex] of cases) {
    const metadata = pageMetadata({ path, title: "Example", description: "Example" });
    assert.equal(metadata.alternates?.canonical, canonical, path);
    assert.deepEqual(metadata.robots, noindex ? { index: false, follow: true } : undefined, path);
    for (const type of ["text/html", "text/markdown", "text/x-component"]) {
      const response = withRepresentationHeaders(new Request(`https://zips.tools${path}`), new Response("", { headers: { "Content-Type": type } }), path);
      assert.ok(response.headers.get("Link")?.startsWith(`<https://zips.tools${canonical}>; rel="canonical"`), path);
      assert.equal(response.headers.get("X-Robots-Tag"), noindex ? "noindex, follow" : null, path);
    }
  }
});

test("legacy host and proposal aliases redirect in one hop, preserving query and representation", () => {
  for (const suffix of ["", ".md"]) {
    const source = new URL(`https://zip-tools-web.harpocrates.workers.dev/zip/0032${suffix}?part=2`);
    assert.equal(canonicalRedirect(source)?.href, `https://zips.tools/zip/32${suffix}?part=2`);
    assert.equal(canonicalRedirect(new URL(`https://zips.tools/zip/ZIP-0032${suffix}?part=2`))?.href, `https://zips.tools/zip/32${suffix}?part=2`);
  }
  assert.equal(canonicalRedirect(new URL("https://zip-tools-web.harpocrates.workers.dev/zips?kind=draft"))?.href, "https://zips.tools/zips?kind=draft");
  for (const path of ["https://zips.tools/zip/32?part=2", "http://localhost:3100/zip/32", "https://zips.tools/api/zip/0032"]) {
    assert.equal(canonicalRedirect(new URL(path)), null);
  }
});
