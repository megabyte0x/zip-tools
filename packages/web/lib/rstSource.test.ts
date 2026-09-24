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

test("rstSourceToMarkdown keeps grid tables readable as preformatted text", () => {
  const md = rstSourceToMarkdown("+----+----+\n| a  | b  |\n+----+----+\n\nAfter.");
  assert.match(md, /```\n\+----\+----\+\n\| a  \| b  \|\n\+----\+----\+\n```/);
});
