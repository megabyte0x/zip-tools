import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToMarkdown, paginateReader } from "./agentDocuments.ts";
import { readFileSync } from "node:fs";
import { prepareReader } from "./prepareReader.ts";
import { zipHref } from "./zipHref.ts";
import type { ZipIndexFile } from "./types.ts";
import { unified } from "unified";
import rehypeParse from "rehype-parse";

test("Markdown preserves semantic links, tables, code and the original TeX once", () => {
  const html = '<h2 id="spec">Specification</h2><p>See <a href="/zip/32">ZIP 32</a>.</p><pre><code>let x = 1;</code></pre><table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>2</td></tr></table><span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span><span class="katex-html">x2</span></span>';
  const markdown = htmlToMarkdown(html);
  assert.match(markdown, /## Specification/);
  assert.match(markdown, /\[ZIP 32\]\(\/zip\/32\)/);
  assert.match(markdown, /```\nlet x = 1;\n```/);
  assert.match(markdown, /\| Name \| Value \|\n\| --- \| --- \|\n\| A \| 2 \|/);
  assert.equal(markdown.match(/x\^2/g)?.length, 1);
  assert.ok(!markdown.includes("x2"));
});

test("pagination keeps every block and rewrites cross-part citations", () => {
  const html = '<h2 id="one">One</h2><p>' + 'a'.repeat(80) + '</p><h2 id="two">Two</h2><p>See <a href="#one">One</a> ' + 'b'.repeat(80) + '</p>';
  const document = { html, toc: [{ id: "one", text: "One", level: 2 as const }, { id: "two", text: "Two", level: 2 as const }], mode: "full" as const, warnings: [] };
  const parts = paginateReader(document, "/zip/1", 100);
  assert.equal(parts.length, 2);
  assert.match(parts[0].html, /a{80}/);
  assert.match(parts[1].html, /b{80}/);
  assert.match(parts[1].html, /href="\/zip\/1#one"/);
  assert.deepEqual(parts[1].toc.map((x) => x.id), ["two"]);
  assert.equal(document.html, html);
});

test("small documents stay on their original direct URL", () => {
  const document = { html: '<p>Short</p>', toc: [], mode: "full" as const, warnings: [] };
  assert.equal(paginateReader(document, "/zip/1").length, 1);
});

test("Markdown retains numbered-list start values and nested list structure", () => {
  const output = htmlToMarkdown('<ol start="3"><li>Third<ul><li>Nested</li></ul></li><li>Fourth</li></ol>');
  assert.match(output, /3\. Third/);
  assert.match(output, /  - Nested/);
  assert.match(output, /4\. Fourth/);
});

test("every corpus document keeps all text and each HTML part fits the reading budget", async () => {
  const index = JSON.parse(readFileSync(new URL("../data/zip-index.json", import.meta.url), "utf8")) as ZipIndexFile;
  type Node = { value?: string; children?: Node[] };
  const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join("");
  const parser = unified().use(rehypeParse, { fragment: true });
  for (const zip of index.zips) {
    const document = await prepareReader(zip);
    const parts = paginateReader(document, zipHref(zip));
    const original = text(parser.parse(document.html) as Node);
    const reconstructed = parts.map((part) => text(parser.parse(part.html) as Node));
    assert.equal(reconstructed.join(""), original, `text lost or duplicated: ${zip.id}`);
    for (const [i, body] of reconstructed.entries()) assert.ok(body.length < 80000, `${zip.id} part ${i + 1} is too long: ${body.length}`);
  }
});
