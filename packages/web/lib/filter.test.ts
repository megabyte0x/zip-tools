import { test } from "node:test";
import assert from "node:assert/strict";
import { filterZips } from "./filter.ts";
import type { ZipRecord } from "./types.ts";
import { makeZip } from "./test-zip.ts";

const zips: ZipRecord[] = [
  makeZip({
    id: "zip-0032",
    number: 32,
    slug: "zip-0032",
    title: "Shielded Hierarchical Deterministic Wallets",
    status: [{ label: "Final" }],
    statusRaw: "Final",
    category: "Standards Track",
    owners: [{ name: "Daira-Emma Hopwood" }],
    nuIds: ["nu6.3"],
  }),
  makeZip({
    id: "zip-0317",
    number: 317,
    slug: "zip-0317",
    title: "Proportional Transfer Fee Mechanism",
    status: [{ label: "Proposed" }],
    statusRaw: "Proposed",
    category: "Standards Track",
    owners: [{ name: "Nathan Wilcox" }],
    nuIds: ["nu6.2"],
  }),
  makeZip({
    id: "draft-foo",
    number: null,
    slug: "draft-foo",
    title: "Draft Something",
    status: [{ label: "Draft" }],
    statusRaw: "Draft",
    category: "Informational",
    owners: [{ name: "Bob" }],
    nuIds: [],
  }),
];

const revisionZips: ZipRecord[] = [
  makeZip({
    id: "zip-0010",
    number: 10,
    title: "alpha",
    status: [{ label: "Proposed" }],
    statusRaw: "Proposed for NU6.3",
    category: "Core Plus",
    nuIds: ["nu6.30"],
  }),
  makeZip({ id: "draft-z", number: null, slug: "draft-z", title: "Beta" }),
  makeZip({
    id: "zip-0002",
    number: 2,
    title: "Zulu",
    status: [
      { label: "Proposed", revision: "1" },
      { label: "Final", revision: "2" },
    ],
    statusRaw: "Revision 1: Proposed; Revision 2: Final",
    category: "Core",
    nuIds: ["nu6.3"],
  }),
  makeZip({ id: "draft-a", number: null, slug: "draft-a", title: "Beta" }),
];

test("filterZips matches text against ZIP number", () => {
  const result = filterZips(zips, { text: "32" });
  assert.deepEqual(
    result.map((z) => z.id),
    ["zip-0032"],
  );
});

test("filterZips matches text against title case-insensitively", () => {
  const result = filterZips(zips, { text: "hierarchical" });
  assert.deepEqual(
    result.map((z) => z.id),
    ["zip-0032"],
  );
});

test("filterZips matches text against owner name case-insensitively", () => {
  const result = filterZips(zips, { text: "daira-emma" });
  assert.deepEqual(
    result.map((z) => z.id),
    ["zip-0032"],
  );
});

test("filterZips matches status", () => {
  const result = filterZips(zips, { status: "Draft" });
  assert.deepEqual(
    result.map((z) => z.id),
    ["draft-foo"],
  );
});

test("filterZips matches NU id", () => {
  const result = filterZips(zips, { nuId: "nu6.3" });
  assert.deepEqual(
    result.map((z) => z.id),
    ["zip-0032"],
  );
});

test("filterZips returns all zips when text is empty and no filters are set", () => {
  assert.equal(filterZips(zips, {}).length, 3);
  assert.equal(filterZips(zips, { text: "" }).length, 3);
});

test("filterZips returns an empty array when nothing matches", () => {
  const result = filterZips(zips, { text: "no-such-zip" });
  assert.deepEqual(result, []);
});

test("filterZips kind draft keeps only number === null", () => {
  const result = filterZips(zips, { kind: "draft" });
  assert.deepEqual(result.map((z) => z.id), ["draft-foo"]);
});

test("filterZips kind numbered drops drafts", () => {
  const result = filterZips(zips, { kind: "numbered" });
  assert.equal(result.some((z) => z.number === null), false);
});

test("filterZips matches exact parsed status labels instead of statusRaw substrings", () => {
  assert.deepEqual(
    filterZips(revisionZips, { status: "Final" }).map((zip) => zip.id),
    ["zip-0002"],
  );
  assert.deepEqual(filterZips(revisionZips, { status: "NU6.3" }), []);
});

test("filterZips matches NU and category values exactly", () => {
  assert.deepEqual(
    filterZips(revisionZips, { nuId: "nu6.3" }).map((zip) => zip.id),
    ["zip-0002"],
  );
  assert.deepEqual(
    filterZips(revisionZips, { category: "Core" }).map((zip) => zip.id),
    ["zip-0002"],
  );
});

test("filterZips sorts numbered ZIPs numerically with stable drafts last", () => {
  assert.deepEqual(
    filterZips(revisionZips, { sort: "number" }).map((zip) => zip.id),
    ["zip-0002", "zip-0010", "draft-z", "draft-a"],
  );
});

test("filterZips sorts titles case-insensitively and preserves equal-title order", () => {
  assert.deepEqual(
    filterZips(revisionZips, { sort: "title" }).map((zip) => zip.id),
    ["zip-0010", "draft-z", "draft-a", "zip-0002"],
  );
});

test("filterZips sorts a copy without mutating the corpus", () => {
  const original = [...revisionZips];
  filterZips(revisionZips, { text: " BETA ", sort: "title" });
  filterZips(revisionZips, { sort: "number" });
  assert.deepEqual(revisionZips, original);
});
