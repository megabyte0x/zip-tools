import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDay, newestZips } from "./recent.ts";
import { makeZip } from "./test-zip.ts";

test("newestZips sorts by created desc, skips undated, honours limit", () => {
  const zips = [
    makeZip({ id: "1", number: 1, created: "2020-01-01" }),
    makeZip({ id: "2", number: 2, created: null }),
    makeZip({ id: "3", number: 3, created: "2026-06-13" }),
    makeZip({ id: "4", number: 4, created: "2024-02-29" }),
    makeZip({ id: "d", number: null, slug: "draft-x", created: "2026-07-01" }),
  ];
  assert.deepEqual(newestZips(zips, 3).map((z) => z.id), ["d", "3", "4"]);
  assert.deepEqual(newestZips(zips).map((z) => z.id), ["d", "3", "4", "1"]);
});

test("newestZips breaks created ties by higher number first", () => {
  const zips = [
    makeZip({ id: "5", number: 5, created: "2025-01-01" }),
    makeZip({ id: "9", number: 9, created: "2025-01-01" }),
  ];
  assert.deepEqual(newestZips(zips).map((z) => z.id), ["9", "5"]);
});

test("formatDay renders a short UTC day and rejects junk", () => {
  assert.equal(formatDay("2026-06-13"), "Jun 13, 2026");
  assert.equal(formatDay("2024-02-29"), "Feb 29, 2024");
  assert.equal(formatDay(""), null);
  assert.equal(formatDay(null), null);
  assert.equal(formatDay("someday"), null);
});
