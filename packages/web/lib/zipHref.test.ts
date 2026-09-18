import { test } from "node:test";
import assert from "node:assert/strict";
import { zipHref } from "./zipHref.ts";
import { makeZip } from "./test-zip.ts";

test("zipHref uses /zip/{number} for numbered ZIPs", () => {
  assert.equal(zipHref(makeZip({ number: 32, slug: "zip-0032" })), "/zip/32");
});

test("zipHref uses /draft/{slug} when number is null", () => {
  assert.equal(zipHref(makeZip({ number: null, slug: "draft-foo" })), "/draft/draft-foo");
});
