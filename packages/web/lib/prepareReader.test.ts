import { test } from "node:test";
import assert from "node:assert/strict";
import { makeZip } from "./test-zip.ts";
import { prepareReader } from "./prepareReader.ts";

test("prepareReader sanitizes HTML while preserving safe code and math markup", async () => {
  const doc = await prepareReader(makeZip({
    bodyKind: "rst",
    bodyFormat: "html",
    body: [
      '<h2>Intro</h2><script>alert(1)</script>',
      '<p><img src="javascript:alert(1)" onerror="alert(1)">Text</p>',
      '<pre><code class="language-rust">let x = 1;</code></pre>',
      '<span class="katex"><math><semantics><mrow><mi>x</mi></mrow>',
      '<annotation encoding="application/x-tex">x</annotation></semantics></math></span>',
    ].join(""),
  }));

  assert.equal(doc.mode, "full");
  assert.ok(!doc.html.includes("<script"));
  assert.ok(!doc.html.includes("onerror"));
  assert.ok(!doc.html.includes("javascript:"));
  assert.match(doc.html, /<pre><code class="language-rust">let x = 1;<\/code><\/pre>/);
  assert.match(doc.html, /class="katex"/);
  assert.match(doc.html, /<math>/);
  assert.ok(doc.html.includes(`id="${doc.toc[0]?.id}"`));
});

test("prepareReader preserves unique existing heading ids and allocates collisions", async () => {
  const doc = await prepareReader(makeZip({
    bodyFormat: "html",
    bodyKind: "rst",
    body: '<h2 id="kept">First</h2><h2 id="kept">Second</h2><h2>First</h2>',
  }));
  assert.deepEqual(doc.toc.map((heading) => heading.id), ["kept", "second", "first"]);
  assert.equal(new Set(doc.toc.map((heading) => heading.id)).size, 3);
  for (const heading of doc.toc) assert.ok(doc.html.includes(`id="${heading.id}"`));
});

test("prepareReader renders markdown headings from visible links images and code", async () => {
  const doc = await prepareReader(makeZip({
    bodyFormat: "markdown",
    bodyKind: "md",
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/zip-0032.md",
    body: [
      "## See [ZIP 32](zip-0032.rst) and `Orchard`",
      "",
      "### Logo ![Zcash](images/logo.svg)",
    ].join("\n"),
  }));

  assert.equal(doc.mode, "full");
  assert.deepEqual(doc.toc, [
    { id: "see-zip-32-and-orchard", text: "See ZIP 32 and Orchard", level: 2 },
    { id: "logo-zcash", text: "Logo Zcash", level: 3 },
  ]);
  assert.match(doc.html, /href="\/zip\/32"/);
  assert.match(doc.html, /src="https:\/\/raw\.githubusercontent\.com\/zcash\/zips\/deadbeef\/zips\/images\/logo\.svg"/);
});

test("prepareReader preserves safe markdown HTML while sanitizing unsafe raw HTML", async () => {
  const doc = await prepareReader(makeZip({
    bodyFormat: "markdown",
    bodyKind: "md",
    body: "## Data\n\n<table><tbody><tr><td>Value</td></tr></tbody></table><script>bad()</script>",
  }));
  assert.match(doc.html, /<table>/);
  assert.match(doc.html, /<td>Value<\/td>/);
  assert.ok(!doc.html.includes("<script"));
});

test("prepareReader renders retained RST prose in explicitly degraded mode", async () => {
  const doc = await prepareReader(makeZip({
    bodyFormat: "rst-source",
    bodyKind: "rst",
    body: "Abstract\n========\n\nActual proposal prose.\n\nMotivation\n----------\n\nBecause privacy matters.",
  }));

  assert.equal(doc.mode, "degraded");
  assert.match(doc.html, /Actual proposal prose/);
  assert.match(doc.html, /Because privacy matters/);
  assert.deepEqual(doc.toc.map((heading) => heading.text), ["Abstract", "Motivation"]);
  assert.ok(doc.warnings.some((warning) => /full-fidelity RST conversion was unavailable/i.test(warning)));
});

test("prepareReader returns missing mode only when content is absent", async () => {
  const doc = await prepareReader(makeZip({ bodyFormat: "none", bodyKind: "none", body: null }));
  assert.deepEqual(doc, { html: "", toc: [], mode: "missing", warnings: [] });
});
