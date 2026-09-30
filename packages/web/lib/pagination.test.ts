import assert from "node:assert/strict";
import { test } from "node:test";
import { paginateResults } from "./pagination.ts";

test("paginateResults clamps range", () => {
  const items = Array.from({ length: 135 }, (_, index) => index + 1);
  const first = paginateResults(items, 1);
  const last = paginateResults(items, 6);
  const clamped = paginateResults(items, 99);
  const empty = paginateResults([], 99);

  assert.deepEqual([first.items.length, first.start, first.end], [25, 1, 25]);
  assert.deepEqual([last.items.length, last.start, last.end], [10, 126, 135]);
  assert.deepEqual([clamped.items.length, clamped.page, clamped.pageCount], [10, 6, 6]);
  assert.deepEqual([empty.items, empty.page, empty.pageCount, empty.start, empty.end], [[], 1, 0, 0, 0]);
});
