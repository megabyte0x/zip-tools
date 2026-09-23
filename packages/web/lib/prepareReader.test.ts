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

test("prepareReader preserves safe KaTeX structures for representative markdown math", async () => {
  const doc = await prepareReader(makeZip({
    bodyFormat: "markdown",
    bodyKind: "md",
    body: "## Formula\n\n$$\\frac{x^2}{\\sqrt{y}}$$",
  }));

  assert.match(doc.html, /<mfrac><msup>/);
  assert.match(doc.html, /<msqrt>/);
  assert.match(doc.html, /class="[^"]*mfrac[^"]*"/);
  assert.match(doc.html, /class="[^"]*sqrt[^"]*"/);
  assert.match(doc.html, /class="[^"]*msupsub[^"]*"/);
  assert.match(doc.html, /style="[^"]+"/);
  assert.match(doc.html, /<svg[^>]*><path d="[^"]+"><\/path><\/svg>/);
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

test("prepareReader allocates heading ids against ids on non-heading elements", async () => {
  const doc = await prepareReader(makeZip({
    bodyFormat: "html",
    bodyKind: "rst",
    body: '<div id="intro">Anchor</div><h2 id="intro">Intro</h2>',
  }));

  assert.deepEqual(doc.toc.map((heading) => heading.id), ["intro-2"]);
  assert.match(doc.html, /<div id="intro">Anchor<\/div>/);
  assert.equal(doc.html.match(/id="intro"/g)?.length, 1);
  assert.match(doc.html, /<h2 id="intro-2">Intro<\/h2>/);
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
    body: [
      "## Data",
      "",
      '<table><tbody><tr><td>Value</td></tr></tbody></table>',
      '<a href="javascript:alert(1)" onclick="alert(1)">bad link</a>',
      '<img src="javascript:alert(1)" onerror="alert(1)">',
      "<script>bad()</script>",
    ].join("\n"),
  }));
  assert.match(doc.html, /<table>/);
  assert.match(doc.html, /<td>Value<\/td>/);
  assert.ok(!doc.html.includes("<script"));
  assert.ok(!doc.html.includes("javascript:"));
  assert.ok(!doc.html.includes("onclick"));
  assert.ok(!doc.html.includes("onerror"));
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

test("issue descriptions use the sanitized reader, local TOC fragments, and issue-relative URLs", async () => {
  const doc = await prepareReader(makeZip({
    bodyKind: "md",
    bodyFormat: "markdown",
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/zip-2007.md",
    body: [
      "## Motivation",
      "",
      "[Fragment](#motivation) [ZIP 2005](https://zips.z.cash/zip-2005) [Issue](../1303)",
      "[Nested ZIP](notes/zip-0032.rst) [Unsafe](javascript:alert(1))",
      "",
      "| A | B |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "$x^2$",
      "",
      "![Issue diagram](diagram.png)",
      "![Attachment](https://github.com/user-attachments/assets/123/diagram.png)",
      "",
      "<script>alert(1)</script>",
    ].join("\n"),
    bodySource: {
      kind: "github-issue",
      url: "https://github.com/zcash/zips/issues/1302",
      title: "Fixture",
      updatedAt: "2026-07-05T21:00:43Z",
      fetchedAt: "2026-09-23T00:00:00Z",
      contentHash: "a".repeat(64),
    },
  }));

  assert.equal(doc.mode, "full");
  assert.equal(doc.toc[0]?.id, "motivation");
  assert.match(doc.html, /<div class="reader-table-scroll"><table>/);
  assert.match(doc.html, /<table>/);
  assert.match(doc.html, /<math/);
  assert.match(doc.html, /href="#motivation"/);
  assert.match(doc.html, /href="\/zip\/2005"/);
  assert.match(doc.html, /href="https:\/\/github\.com\/zcash\/zips\/1303"/);
  assert.match(
    doc.html,
    /href="https:\/\/github\.com\/zcash\/zips\/issues\/notes\/zip-0032\.rst"/,
  );
  assert.doesNotMatch(doc.html, /href="\/zip\/32"/);
  assert.match(
    doc.html,
    /src="https:\/\/github\.com\/zcash\/zips\/issues\/diagram\.png"/,
  );
  assert.match(
    doc.html,
    /src="https:\/\/github\.com\/user-attachments\/assets\/123\/diagram\.png"/,
  );
  assert.doesNotMatch(doc.html, /<script|javascript:|raw\.githubusercontent\.com/i);
});

test("prepareReader rejects relative issue destinations when issue provenance is invalid", async () => {
  const doc = await prepareReader(makeZip({
    bodyKind: "md",
    bodyFormat: "markdown",
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/zip-2007.md",
    body: "[Relative ZIP](zip-0032.rst) ![Relative image](diagram.png)",
    bodySource: {
      kind: "github-issue",
      url: "https://github.com/zcash/zips/issues/01302",
      title: "Invalid fixture",
      updatedAt: "2026-07-05T21:00:43Z",
      fetchedAt: "2026-09-23T00:00:00Z",
      contentHash: "a".repeat(64),
    },
  }));

  assert.match(doc.html, /href="#"/);
  assert.doesNotMatch(doc.html, /href="\/zip\/32"|src=|raw\.githubusercontent\.com/);
});
