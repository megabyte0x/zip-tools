import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseReadingList,
  addToReadingList,
  removeFromReadingList,
  shareReadingList,
} from "./readingList.ts";

test("parseReadingList returns [] for null or invalid JSON", () => {
  assert.deepEqual(parseReadingList(null), []);
  assert.deepEqual(parseReadingList("{"), []);
});

test("addToReadingList prepends and drops oldest past 200", () => {
  const existing = Array.from({ length: 200 }, (_, i) => ({
    id: String(i),
    title: `t${i}`,
    href: `/zip/${i}`,
  }));
  const next = addToReadingList(existing, { id: "x", title: "X", href: "/zip/9" }, 200);
  assert.equal(next.length, 200);
  assert.equal(next[0].id, "x");
  assert.equal(next[199].id, "198");
});

test("addToReadingList moves duplicate id to front", () => {
  const existing = [
    { id: "a", title: "A", href: "/zip/1" },
    { id: "b", title: "B", href: "/zip/2" },
    { id: "c", title: "C", href: "/zip/3" },
  ];
  const next = addToReadingList(existing, { id: "b", title: "B2", href: "/zip/2b" });
  assert.equal(next.length, 3);
  assert.deepEqual(next[0], { id: "b", title: "B2", href: "/zip/2b" });
  assert.equal(next[1].id, "a");
  assert.equal(next[2].id, "c");
});

test("removeFromReadingList drops matching id", () => {
  const items = [
    { id: "a", title: "A", href: "/zip/1" },
    { id: "b", title: "B", href: "/zip/2" },
  ];
  assert.deepEqual(removeFromReadingList(items, "a"), [
    { id: "b", title: "B", href: "/zip/2" },
  ]);
});

test("shareReadingList joins absolute URLs", () => {
  assert.equal(
    shareReadingList("https://zip.tools", [{ id: "32", title: "HD", href: "/zip/32" }]),
    "https://zip.tools/zip/32",
  );
});
