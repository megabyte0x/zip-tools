import { test } from "node:test";
import assert from "node:assert/strict";
import { rstSourceToMarkdown } from "./rstSource.ts";

test("rstSourceToMarkdown skips :: field list and turns underlined titles into headings", () => {
  const md = rstSourceToMarkdown(
    "::\n\n  ZIP: 32\n  Title: Wallets\n\nAbstract\n========\n\nHello wallets.\n\nMotivation\n----------\n\nWhy.\n",
  );
  assert.equal(md.includes("ZIP: 32"), false);
  assert.match(md, /^## Abstract/m);
  assert.match(md, /^### Motivation/m);
  assert.match(md, /Hello wallets/);
});
