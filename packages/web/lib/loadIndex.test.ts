import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadIndex } from "./loadIndex.ts";

const fixture = {
  snapshot: {
    sha: "abcdef1234567890",
    date: "2026-09-18",
    url: "https://github.com/zcash/zips/commit/abcdef1234567890",
  },
  zips: [],
  nus: [],
  dangling: [],
};

test("loadIndex round-trips snapshot.sha from ZIP_INDEX_PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-index-"));
  const path = join(dir, "zip-index.json");
  writeFileSync(path, JSON.stringify(fixture));
  const prev = process.env.ZIP_INDEX_PATH;
  process.env.ZIP_INDEX_PATH = path;
  try {
    const index = loadIndex();
    assert.equal(index.snapshot.sha, fixture.snapshot.sha);
  } finally {
    if (prev === undefined) delete process.env.ZIP_INDEX_PATH;
    else process.env.ZIP_INDEX_PATH = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadIndex throws if the index file is missing", () => {
  const prev = process.env.ZIP_INDEX_PATH;
  process.env.ZIP_INDEX_PATH = join(tmpdir(), "no-such-zip-index.json");
  try {
    assert.throws(() => loadIndex());
  } finally {
    if (prev === undefined) delete process.env.ZIP_INDEX_PATH;
    else process.env.ZIP_INDEX_PATH = prev;
  }
});
