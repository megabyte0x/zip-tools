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
