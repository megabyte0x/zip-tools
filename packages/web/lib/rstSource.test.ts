import { test } from "node:test";
import assert from "node:assert/strict";
import { rstSourceToMarkdown } from "./rstSource.ts";

test("rstSourceToMarkdown converts overlined titles without leaving delimiter text", () => {
  const md = rstSourceToMarkdown("=========\nZIP Title\n=========\n\nActual prose.");
  assert.match(md, /^## ZIP Title/m);
  assert.ok(!md.split("\n").includes("========="));
  assert.match(md, /Actual prose\./);
});

test("rstSourceToMarkdown skips :: field list and turns underlined titles into headings", () => {
  const md = rstSourceToMarkdown(
    "::\n\n  ZIP: 32\n  Title: Wallets\n\nAbstract\n========\n\nHello wallets.\n\nMotivation\n----------\n\nWhy.\n",
  );
  assert.equal(md.includes("ZIP: 32"), false);
  assert.match(md, /^## Abstract/m);
  assert.match(md, /^### Motivation/m);
  assert.match(md, /Hello wallets/);
});

test("rstSourceToMarkdown turns wrapped RST reference definitions into linked list items", () => {
  const md = rstSourceToMarkdown([
    "References",
    "==========",
    "",
    ".. [#BCP14] Information on BCP 14 <https://www.rfc-editor.org/info/bcp14>_",
    ".. [#protocol-networks] Zcash Protocol Specification. Mainnet and Testnet",
    "   <protocol/protocol.pdf#networks>_",
    ".. [#zip-0200] ZIP 200: Network Upgrade Mechanism <zip-0200.rst>_",
  ].join("\n"));

  assert.match(md, /- \[Information on BCP 14\]\(https:\/\/www\.rfc-editor\.org\/info\/bcp14\)/);
  assert.match(md, /- \[Zcash Protocol Specification\. Mainnet and Testnet\]\(https:\/\/zips\.z\.cash\/protocol\/protocol\.pdf#networks\)/);
  assert.match(md, /- \[ZIP 200: Network Upgrade Mechanism\]\(https:\/\/zips\.z\.cash\/zip-0200\.rst\)/);
  assert.doesNotMatch(md, /\.\. \[#(?:BCP14|protocol-networks|zip-0200)\]/);
});

test("rstSourceToMarkdown turns standard backticked RST references into links", () => {
  const md = rstSourceToMarkdown(
    ".. [#zip-0200] `ZIP 200: Network Upgrade Mechanism <zip-0200.rst>`_",
  );

  assert.equal(md, "- [ZIP 200: Network Upgrade Mechanism](https://zips.z.cash/zip-0200.rst)");
});

test("rstSourceToMarkdown keeps math: dollar spans, :math: roles and .. math:: blocks", () => {
  const md = rstSourceToMarkdown([
    "Let $\\mathsf{a}_b$ and :math:`x^2` hold.",
    "",
    ".. math::",
    "    \\mathsf{f}(x) :=",
    "      1",
    "",
    "After.",
  ].join("\n"));
  assert.match(md, /Let \$\\mathsf\{a\}_b\$ and \$x\^2\$ hold\./);
  assert.match(md, /\$\$\n\\mathsf\{f\}\(x\) :=\n  1\n\$\$/);
  assert.match(md, /After\./);
});

test("rstSourceToMarkdown turns admonitions into labelled blockquotes", () => {
  const md = rstSourceToMarkdown(".. warning::\n   This ZIP has been obsoleted.\n   Read ZIP 2.\n\nNext.");
  assert.match(md, /^> \*\*Warning\*\*\n> \n> This ZIP has been obsoleted\.\n> Read ZIP 2\./m);
  assert.match(md, /Next\./);
});

test("rstSourceToMarkdown fences code directives and :: literal blocks", () => {
  const md = rstSourceToMarkdown([
    ".. code-block:: rust",
    "",
    "    let x = 1;",
    "    let y = 2;",
    "",
    "For example::",
    "",
    "    a  b",
    "",
    ".. highlight::c++",
    "",
    "Done.",
  ].join("\n"));
  assert.match(md, /```rust\nlet x = 1;\nlet y = 2;\n```/);
  assert.match(md, /For example:\n\n```\na  b\n```/);
  assert.ok(!md.includes("highlight"));
  assert.match(md, /Done\./);
});

test("rstSourceToMarkdown renders figures, raw html and drops role declarations", () => {
  const md = rstSourceToMarkdown([
    ".. role:: editor-note",
    "",
    ".. figure:: ../rendered/assets/images/diagram.svg",
    "    :width: 600px",
    "    :align: center",
    "",
    ".. raw:: html",
    "",
    "    <details><summary>Click</summary>",
    "",
    "Body.",
  ].join("\n"));
  assert.ok(!md.includes(".. "));
  assert.match(md, /!\[\]\(\.\.\/rendered\/assets\/images\/diagram\.svg\)/);
  assert.match(md, /<details><summary>Click<\/summary>/);
  assert.match(md, /Body\./);
});

test("rstSourceToMarkdown converts inline literals, links, citations and substitutions", () => {
  const md = rstSourceToMarkdown(
    "Use ``nVersion`` per `ZIP 200 <zip-0200.rst>`_ and [#protocol]_.|br| Next `spec`_ here.",
  );
  assert.equal(
    md,
    "Use `nVersion` per [ZIP 200](zip-0200.rst) and [protocol].<br> Next spec here.",
  );
});

test("rstSourceToMarkdown turns regular grid tables into tables, keeping math", () => {
  const md = rstSourceToMarkdown([
    "+------+-------------------+",
    "| Name | Size              |",
    "+======+===================+",
    "| a    | :math:`2 \\cdot n` |",
    "|      | bytes             |",
    "+------+-------------------+",
    "",
    "After.",
  ].join("\n"));
  assert.match(md, /^\| Name \| Size \|\n\| --- \| --- \|\n\| a \| \$2 \\cdot n\$ bytes \|$/m);
});

test("rstSourceToMarkdown keeps grid tables with spanning cells preformatted", () => {
  const md = rstSourceToMarkdown("+----+----+\n| spans both |\n+----+----+\n\nAfter.");
  assert.match(md, /```\n\+----\+----\+\n\| spans both \|\n\+----\+----\+\n```/);
});

test("rstSourceToMarkdown joins inline literals that wrap across lines", () => {
  assert.equal(rstSourceToMarkdown("uses ``sum(a\n  * b)`` here"), "uses `sum(a * b)` here");
});

test("rstSourceToMarkdown keeps backtick section underlines as headings", () => {
  const md = rstSourceToMarkdown("Magic Bytes\n``````````\n\nEach ``net`` has bytes.");
  assert.equal(md, "## Magic Bytes\n\nEach `net` has bytes.");
});

test("rstSourceToMarkdown turns indented block quotes into quotes, keeping their math", () => {
  const md = rstSourceToMarkdown([
    "it will be modified to read:",
    "",
    "    Each element of $\\mathsf{fs.Recipients}$ MUST represent",
    "    a transparent P2SH address.",
    "",
    "    Define $x$ as follows:",
    "",
    "After.",
  ].join("\n"));
  assert.match(md, /^> Each element of \$\\mathsf\{fs\.Recipients\}\$ MUST represent\n> a transparent P2SH address\.\n>\n> Define \$x\$ as follows:$/m);
  assert.ok(!/^ {4}Each/m.test(md), "no four-space indent survives to become a code block");
  assert.match(md, /After\./);
});

test("rstSourceToMarkdown keeps list continuations as list content, not quotes", () => {
  const md = rstSourceToMarkdown("- first item\n\n  continued paragraph\n\n  - nested item\n\nAfter.");
  assert.ok(!md.includes("> "), md);
  assert.match(md, /^- first item\n\n {2}continued paragraph\n\n {2}- nested item/m);
});

test("rstSourceToMarkdown accepts every RST underline character and ranks styles by first use", () => {
  const md = rstSourceToMarkdown([
    "Specification",
    "=============",
    "",
    "Digests",
    "-------",
    "",
    "T.3.0: transparent_effects_digest",
    ".................................",
    "",
    "Body.",
    "",
    "More",
    "====",
  ].join("\n"));
  assert.match(md, /^## Specification$/m);
  assert.match(md, /^### Digests$/m);
  assert.match(md, /^#### T\.3\.0: transparent_effects_digest$/m);
  assert.match(md, /^## More$/m);
  assert.ok(!md.includes("....."));
});

test("rstSourceToMarkdown quotes an indented list that follows a paragraph", () => {
  const md = rstSourceToMarkdown("it will read:\n\n    - In each block $\\mathsf{cb}$ at height\n      $h$, pay.\n\nAfter.");
  assert.match(md, /^> - In each block \$\\mathsf\{cb\}\$ at height\n>   \$h\$, pay\.$/m);
});

test("rstSourceToMarkdown keeps a .. math:: formula written on the directive line", () => {
  assert.equal(rstSourceToMarkdown(".. math:: [\\mathsf{a}] \\,||\\, b\n\nAfter."), "$$\n[\\mathsf{a}] \\,||\\, b\n$$\n\nAfter.");
});

test("rstSourceToMarkdown turns simple tables into tables and keeps their math", () => {
  const md = rstSourceToMarkdown([
    "==================  ============  ==========",
    "Parameter           Value         Units",
    "==================  ============  ==========",
    ":math:`\\mathit{m}`  :math:`5000`  zatoshis per",
    "                                  action",
    "grace               2             actions",
    "==================  ============  ==========",
    "",
    "After.",
  ].join("\n"));
  assert.match(md, /^\| Parameter \| Value \| Units \|\n\| --- \| --- \| --- \|$/m);
  assert.match(md, /^\| \$\\mathit\{m\}\$ \| \$5000\$ \| zatoshis per action \|$/m);
  assert.match(md, /^\| grace \| 2 \| actions \|$/m);
});

test("rstSourceToMarkdown keeps TeX bars inside table math from splitting cells", () => {
  const md = rstSourceToMarkdown([
    "+----+-----------------------------+",
    "| a  | :math:`x \\| y` and a | pipe |",
    "+----+-----------------------------+",
  ].join("\n"));
  assert.equal(md.split("\n")[2], "| a | $x \\Vert  y$ and a \\| pipe |");
});
