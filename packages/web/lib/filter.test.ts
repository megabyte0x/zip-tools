import { test } from "node:test";
import assert from "node:assert/strict";
import { filterZips } from "./filter.ts";
import type { ZipRecord } from "./types.ts";

function makeZip(overrides: Partial<ZipRecord> = {}): ZipRecord {
  return {
    id: "zip-0001",
    number: 1,
    slug: "zip-0001",
    title: "Example ZIP",
    status: [{ label: "Draft" }],
    statusRaw: "Draft",
    category: "Standards Track",
    owners: [{ name: "Alice" }],
    created: null,
    license: null,
    discussionsTo: null,
    nuIds: [],
    citations: [],
    citedBy: [],
    sourcePath: "zips/zip-0001.rst",
    officialUrl: "https://zips.z.cash/zip-0001",
    githubUrl: "",
    bodyKind: "none",
    body: null,
    parseWarnings: [],
    ...overrides,
  };
}

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
