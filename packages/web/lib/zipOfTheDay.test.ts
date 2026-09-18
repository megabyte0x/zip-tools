import { test } from "node:test";
import assert from "node:assert/strict";
import { zipOfTheDay } from "./zipOfTheDay.ts";
import { makeZip } from "./test-zip.ts";

test("zipOfTheDay is stable for a fixed UTC date", () => {
  const zips = [1, 2, 3, 4, 5].map((n) => makeZip({ id: String(n), number: n, title: `Z${n}` }));
  const a = zipOfTheDay(zips, "2026-09-18");
  const b = zipOfTheDay(zips, "2026-09-18");
  assert.equal(a?.number, b?.number);
  assert.equal(zipOfTheDay([], "2026-09-18"), null);
});
