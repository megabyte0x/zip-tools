import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCitations } from "../src/citations.ts";

test("extracts rst, md, and bare zip-NNNN", () => {
  const text = [
    "[#zip-0200]_",
    "[^zip-0224]",
    "[ZIP 224](zip-0224)",
    "zip-0317",
    "zip-guide",
    "zip-template",
    "protocol.pdf",
    "zip-0200",
  ].join("\n");
  const got = extractCitations(text, 317);
  assert.deepEqual(got, [200, 224]);
});

test("keeps unknown numbers", () => {
  assert.deepEqual(extractCitations("see zip-9999", 1), [9999]);
});

test("null selfNumber does not drop any", () => {
  assert.deepEqual(extractCitations("zip-0001", null), [1]);
});
