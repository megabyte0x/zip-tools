import { test } from "node:test";
import assert from "node:assert/strict";
import { slimZipOfTheDay, zipOfTheDay, zotdRows } from "./zipOfTheDay.ts";
import { makeZip } from "./test-zip.ts";

test("zipOfTheDay is stable for a fixed UTC date", () => {
  const zips = [1, 2, 3, 4, 5].map((n) => makeZip({ id: String(n), number: n, title: `Z${n}` }));
  const a = zipOfTheDay(zips, "2026-09-18");
  const b = zipOfTheDay(zips, "2026-09-18");
  assert.equal(a?.number, b?.number);
  assert.equal(zipOfTheDay([], "2026-09-18"), null);
});

test("zotdRows omits rows that have no value", () => {
  const bare = slimZipOfTheDay(makeZip({
    category: null,
    owners: [],
    created: null,
    discussionsTo: null,
    githubUrl: "",
  }));
  assert.deepEqual(zotdRows(bare).map((row) => row.label), ["Links"]);

  const full = slimZipOfTheDay(makeZip({
    category: "Consensus",
    owners: [{ name: "Alice" }],
    created: "2026-06-13",
    discussionsTo: "https://github.com/zcash/zips/issues/1",
    githubUrl: "https://github.com/zcash/zips/blob/main/zips/zip-0001.rst",
  }));
  assert.deepEqual(zotdRows(full).map((row) => row.label), [
    "Category",
    "Owners",
    "Created",
    "Discussions",
    "Links",
  ]);
});
