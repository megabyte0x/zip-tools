import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { protectRstMath } from "../src/rstMath.ts";
import { renderBody } from "../src/renderBody.ts";

test("protectRstMath turns dollar math into :math: roles like upstream render.sh", () => {
  assert.equal(
    protectRstMath("Let $\\mathsf{a}_b$ be $x$ and \\$5 stays money."),
    "Let :math:`\\mathsf{a}_b` be :math:`x` and $5 stays money.",
  );
});

test("protectRstMath works line by line and leaves lone dollars alone", () => {
  assert.equal(protectRstMath("costs $5\nand $10"), "costs $5\nand $10");
  assert.equal(protectRstMath("a $x$\nb $y$"), "a :math:`x`\nb :math:`y`");
});

const hasPandoc = spawnSync("pandoc", ["--version"]).status === 0;

test("rst bodies keep TeX for inline, role and block math", { skip: !hasPandoc }, () => {
  const r = renderBody(
    "zips/zip-9999.rst",
    "Let $\\mathsf{a}_b$ and :math:`x^2`.\n\n.. math::\n    \\mathsf{f}(x) := 1\n",
  );
  assert.equal(r.bodyFormat, "html");
  assert.match(r.body ?? "", /<span class="math inline">\\\(\\mathsf\{a\}_b\\\)<\/span>/);
  assert.match(r.body ?? "", /<span class="math inline">\\\(x\^2\\\)<\/span>/);
  assert.match(r.body ?? "", /<span class="math display">\\\[\\mathsf\{f\}\(x\) := 1\\\]<\/span>/);
});

test("rst raw substitutions such as ZIP 317's |br| render as inline HTML", { skip: !hasPandoc }, () => {
  const r = renderBody(
    "zips/zip-9999.rst",
    ".. |br| raw:: html\n\n  <br/>\n\nLet $a$ be one. |br|\nLet $b$ be two. |br|\nLet $c$ be three.\n",
  );
  assert.doesNotMatch(r.body ?? "", /&lt;br|blockquote/);
  assert.match(
    r.body ?? "",
    /^<p>Let <span class="math inline">\\\(a\\\)<\/span> be one\. <br\/> Let .* be two\. <br\/> Let .* be three\.<\/p>$/m,
  );
});

test("rst footnotes are listed once where defined, like docutils", { skip: !hasPandoc }, () => {
  const r = renderBody(
    "zips/zip-9999.rst",
    [
      "Cites [#b]_ then [#a]_ and [#b]_ again.",
      "",
      "References",
      "==========",
      "",
      ".. [#a] Alpha, later clarified in [#c]_.",
      ".. [#b] Beta.",
      ".. [#c] Gamma.",
      "",
    ].join("\n"),
  );
  const body = r.body ?? "";
  // Numbers follow definition order and repeat for a repeated citation.
  assert.deepEqual([...body.matchAll(/href="#(\w)" class="footnote-ref"[^>]*><sup>(\d)/g)].map((m) => m[1] + m[2]), ["b2", "a1", "b2", "c3"]);
  // One list, inside References, holding every note once; Gamma is cited only from Alpha.
  assert.match(body, /<h1 id="references">References<\/h1>\s*<ol class="footnotes" start="1">\s*<li id="a">.*Alpha.*\n<li id="b">.*Beta.*\n<li id="c">.*Gamma/);
  assert.doesNotMatch(body, /doc-endnotes|fnref\d/);
});
