import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../src/build.ts";
import { readSourceDates } from "../src/snapshot.ts";
import type { NuOverlay, ZipIndexFile, ZipRecord } from "../src/types.ts";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const overlay: NuOverlay = {
  nus: [
    {
      id: "nu6.3",
      title: "NU6.3",
      kind: "candidate",
      deploymentZip: 229,
      zips: [229],
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

// Catches newly built records omitting explicit repository provenance while preserving existing fixture metadata.
test("buildIndex over the fixture tree", () => {
  const index = buildIndex({
    sourceDir: fixturesDir,
    overlay,
    sha: "abc123",
    date: "2026-09-18T00:00:00Z",
  });

  const ids = index.zips.map((z) => z.id).sort();
  assert.deepEqual(ids, ["0", "229", "32", "draft-arya-deploy-nu7"]);
  assert.deepEqual(
    index.zips.map((z) => z.bodySource),
    index.zips.map(() => ({ kind: "repository" })),
  );

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

test("buildIndex fails when the overlay names a ZIP that is not in the source", () => {
  assert.throws(
    () =>
      buildIndex({
        sourceDir: fixturesDir,
        overlay: {
          nus: [
            {
              id: "nu6.3",
              title: "NU6.3",
              kind: "candidate",
              deploymentZip: 229,
              zips: [229, 9999],
            },
          ],
        },
        sha: "abc123",
        date: "2026-09-18T00:00:00Z",
      }),
    /9999/,
  );
});

// Catches CLI fixture tests sharing a global output directory or requiring a snapshot cache to exist.
test("cli build writes parseable zip-index.json", () => {
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const tempDir = mkdtempSync(join(tmpdir(), "zip-index-out-"));
  const outDir = join(tempDir, "out");
  try {
    const overlayPath = join(tempDir, "overlay.json");
    writeFileSync(overlayPath, `${JSON.stringify({ nus: [] })}\n`, "utf8");
    const result = spawnSync(
      "tsx",
      [
        "src/cli.ts",
        "build",
        "--source",
        "test/fixtures/zips",
        "--out",
        outDir,
        "--overlay",
        overlayPath,
      ],
      { cwd: pkgRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
    const outFile = join(outDir, "zip-index.json");
    assert.equal(existsSync(outFile), true);
    JSON.parse(readFileSync(outFile, "utf8"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// Catches sitemap dates taken from a side-branch commit or an older edit instead of the main-line change that published the file.
test("readSourceDates reports each file's latest main-line change, dating merged work at its merge", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-index-dates-"));
  const git = (date: string, ...args: string[]) => {
    const result = spawnSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git("2026-01-01T00:00:00Z", "init", "-q", "-b", "main");
    writeFileSync(join(dir, "a.md"), "a1");
    writeFileSync(join(dir, "b.md"), "b1");
    git("2026-01-01T00:00:00Z", "add", ".");
    git("2026-01-01T00:00:00Z", "commit", "-q", "-m", "first");
    git("2026-02-01T00:00:00Z", "checkout", "-q", "-b", "side");
    writeFileSync(join(dir, "b.md"), "b2");
    git("2026-02-01T00:00:00Z", "commit", "-q", "-am", "edit b on a branch");
    git("2026-03-01T00:00:00Z", "checkout", "-q", "main");
    git("2026-03-01T00:00:00Z", "merge", "-q", "--no-ff", "-m", "merge side", "side");
    assert.deepEqual(readSourceDates(dir), { "b.md": "2026-03-01T00:00:00Z", "a.md": "2026-01-01T00:00:00Z" });
    assert.deepEqual(readSourceDates(join(dir, "missing")), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
