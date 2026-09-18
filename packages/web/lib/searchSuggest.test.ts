import { test } from "node:test";
import assert from "node:assert/strict";
import { searchSuggestions } from "./searchSuggest.ts";
import { makeZip } from "./test-zip.ts";

const zips = [
  makeZip({ id: "32", number: 32, slug: "zip-0032", title: "Shielded HD Wallets" }),
  makeZip({ id: "317", number: 317, slug: "zip-0317", title: "Proportional Transfer Fee Mechanism" }),
  makeZip({ id: "draft-foo", number: null, slug: "draft-foo", title: "Draft Something" }),
];

test("searchSuggestions matches title and returns href plus label", () => {
  const hits = searchSuggestions(zips, "shielded");
  assert.deepEqual(hits, [
    { id: "32", href: "/zip/32", label: "32 — Shielded HD Wallets" },
  ]);
});

test("searchSuggestions caps at 8", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    makeZip({ id: String(i + 1), number: i + 1, slug: `zip-${i + 1}`, title: `Alpha ${i}` }),
  );
  assert.equal(searchSuggestions(many, "alpha").length, 8);
});

test("searchSuggestions empty text returns []", () => {
  assert.deepEqual(searchSuggestions(zips, "  "), []);
});
