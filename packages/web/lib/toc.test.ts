import { test } from "node:test";
import assert from "node:assert/strict";
import { slugifyHeading, tocFromHtml, tocFromMarkdown } from "./toc.ts";

test("slugifyHeading lowercases and hyphenates", () => {
  assert.equal(slugifyHeading("Abstract (ZIP 32)"), "abstract-zip-32");
});

test("tocFromHtml injects ids and suffixes collisions", () => {
  const { html, toc } = tocFromHtml("<h2>Intro</h2><p>x</p><h2>Intro</h2><h3>Details</h3>");
  assert.deepEqual(toc.map((e) => e.id), ["intro", "intro-2", "details"]);
  assert.match(html, /id="intro"/);
  assert.match(html, /id="intro-2"/);
});

test("tocFromMarkdown reads ATX h2 and h3", () => {
  const toc = tocFromMarkdown("## Motivation\n\ntext\n\n### Why\n");
  assert.deepEqual(toc, [
    { id: "motivation", text: "Motivation", level: 2 },
    { id: "why", text: "Why", level: 3 },
  ]);
});
