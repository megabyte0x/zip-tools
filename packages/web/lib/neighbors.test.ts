import { test } from "node:test";
import assert from "node:assert/strict";
import { prevNext } from "./neighbors.ts";
import { makeZip } from "./test-zip.ts";

const zips = [
  makeZip({ number: 1, title: "A" }),
  makeZip({ number: null, slug: "draft-x" }),
  makeZip({ number: 3, title: "C" }),
  makeZip({ number: 2, title: "B" }),
];

test("prevNext skips drafts and uses numeric order", () => {
  const { prev, next } = prevNext(zips, 2);
  assert.equal(prev?.number, 1);
  assert.equal(next?.number, 3);
});

test("prevNext at ends returns null", () => {
  assert.equal(prevNext(zips, 1).prev, null);
  assert.equal(prevNext(zips, 3).next, null);
});
