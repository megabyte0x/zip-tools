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

test("tocFromMarkdown slugs visible text for links, images, and code", () => {
  const toc = tocFromMarkdown(
    "## See [ZIP 32](https://zips.z.cash/zip-032)\n\n### Logo ![Zcash](logo.png) and `Orchard`\n",
  );
  assert.equal(toc[0]?.id, "see-zip-32");
  assert.equal(toc[0]?.text, "See ZIP 32");
  assert.equal(toc[1]?.id, "logo-zcash-and-orchard");
  assert.equal(toc[1]?.text, "Logo Zcash and Orchard");
});

test("tocFromHtml unique ids when existing id collides with generated slug", () => {
  const { html, toc } = tocFromHtml('<h2>Intro</h2><h2 id="intro">Other</h2>');
  assert.deepEqual(toc.map((e) => e.id), ["intro-2", "intro"]);
  assert.match(html, /<h2 id="intro-2">Intro<\/h2>/);
  assert.match(html, /<h2 id="intro">Other<\/h2>/);
});

test("tocFromHtml generated collisions skip reserved existing ids", () => {
  const { toc } = tocFromHtml('<h2 id="intro-2">Foo</h2><h2>Intro</h2><h2>Intro</h2>');
  assert.deepEqual(toc.map((e) => e.id), ["intro-2", "intro", "intro-3"]);
});
