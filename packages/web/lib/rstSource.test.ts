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
