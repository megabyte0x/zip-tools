import { test } from "node:test";
import assert from "node:assert/strict";
import { nuRows } from "./nuBoard.ts";
import type { ZipIndexFile, ZipRecord } from "./types.ts";

function stubZip(partial: Partial<ZipRecord> & Pick<ZipRecord, "id" | "number" | "slug">): ZipRecord {
  return {
    title: "t",
    status: [],
    statusRaw: "",
    category: null,
    owners: [],
    created: null,
    license: null,
    discussionsTo: null,
    nuIds: [],
    citations: [],
    citedBy: [],
    sourcePath: "",
    officialUrl: "",
    githubUrl: "",
    bodyKind: "md",
    body: null,
    parseWarnings: [],
    ...partial,
  };
}

const zip32 = stubZip({
  id: "32",
  number: 32,
  slug: "zip-0032",
  title: "Shielded Hierarchical Deterministic Wallets",
});

const index: ZipIndexFile = {
  snapshot: { sha: "abc", date: "2026-09-18", url: "https://example.test" },
  zips: [zip32],
  nus: [
    {
      id: "nu5",
      title: "NU5",
      kind: "settled",
      deploymentZip: 252,
      zips: [32, 9999],
    },
  ],
  dangling: [],
};

test("nuRows maps a known zip and missing 9999 as record null", () => {
  const rows = nuRows(index, "nu5");
  assert.deepEqual(rows, [
    { number: 32, record: zip32 },
    { number: 9999, record: null },
  ]);
});

test("nuRows returns null for an unknown id", () => {
  assert.equal(nuRows(index, "nu-missing"), null);
});
