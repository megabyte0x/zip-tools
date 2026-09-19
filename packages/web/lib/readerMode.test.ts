import { test } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_CTA, readerMode } from "./readerMode.ts";

test("readerMode returns fallback when body is null", () => {
  assert.equal(readerMode(null, "md"), "fallback");
  assert.equal(readerMode(null, "rst"), "fallback");
  assert.equal(readerMode(null, "none"), "fallback");
});

test("readerMode returns html when body is rst HTML", () => {
  assert.equal(readerMode("<p>rst</p>", "rst"), "html");
});

test("readerMode returns source when rst body is not HTML", () => {
  assert.equal(readerMode("====\nZIP 32\n====\n\nAbstract\n========\n", "rst"), "source");
});

test("readerMode returns markdown for md and draft bodies", () => {
  assert.equal(readerMode("# hello", "md"), "markdown");
  assert.equal(readerMode("# draft", "draft"), "markdown");
});

test("fallback CTA is the exact Open on zips.z.cash copy", () => {
  assert.equal(FALLBACK_CTA, "Open on zips.z.cash");
});
