import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../src/build.ts";
import type { NuOverlay, ZipIndexFile, ZipRecord } from "../src/types.ts";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const overlay: NuOverlay = {
  nus: [
    {
      id: "nu6.3",
      title: "NU6.3",
      kind: "candidate",
      deploymentZip: 229,
      zips: [229, 9999],
    },
  ],
};

function record(index: ZipIndexFile, id: string): ZipRecord {
  const rec = index.zips.find((z) => z.id === id);
  assert.ok(rec, `missing record ${id}`);
  if (!rec) throw new Error(`missing record ${id}`);
  return rec;
}

test("empty dir throws", () => {
  const empty = mkdtempSync(join(tmpdir(), "zip-index-empty-"));
  try {
    assert.throws(() =>
      buildIndex({ sourceDir: empty, overlay: { nus: [] }, sha: "x", date: "" }),
    );
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("buildIndex over the fixture tree", () => {
  const index = buildIndex({
    sourceDir: fixturesDir,
    overlay,
    sha: "abc123",
    date: "2026-09-18T00:00:00Z",
  });

  const ids = index.zips.map((z) => z.id).sort();
  assert.deepEqual(ids, ["0", "229", "32", "draft-arya-deploy-nu7"]);

  assert.equal(
    index.zips.some((z) => z.id === "zip-guide" || z.slug === "zip-guide"),
    false,
  );

  const zip229 = record(index, "229");
  assert.ok(zip229.citations.includes(224));
  assert.ok(index.dangling.includes(224));
  assert.deepEqual(zip229.nuIds, ["nu6.3"]);

  const zip32 = record(index, "32");
  assert.ok(zip32.citedBy.includes(0));
  assert.equal(zip32.officialUrl, "https://zips.z.cash/zip-0032");

  assert.equal(
    index.zips.some((z) => z.number === 9999 || z.id === "9999"),
    false,
  );
});
