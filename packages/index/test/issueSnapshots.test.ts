import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  parseIssueRef,
  issueBodyHash,
  readIssueSnapshots,
  validateIssueSnapshotFile,
  writeIssueSnapshots,
} from "../src/issueSnapshots.ts";
import type { IssueSnapshotFile } from "../src/types.ts";

// Catches permissive parsing that treats non-canonical or unsafe GitHub links as ZIP issues.
test("only explicit zcash ZIP issue URLs qualify", () => {
  const url = "https://github.com/zcash/zips/issues/1302";
  assert.deepEqual(parseIssueRef(url), { url, number: 1302 });
  for (const bad of [
    null,
    "https://github.com/zcash/zips/pull/1302",
    "https://github.com/other/zips/issues/1302",
    "https://github.com/zcash/zips/issues/0",
    "https://github.com/zcash/zips/issues/1302#issuecomment-1",
    "https://github.com/zcash/zips/issues/1302?x=1",
    "https://github.com/zcash/zips/issues/9007199254740992",
    "https://github.com.evil.example/zcash/zips/issues/1302",
  ]) {
    assert.equal(parseIssueRef(bad), null);
  }
});

// Catches hashing normalized text or accepting a snapshot whose body no longer matches its hash.
test("snapshot integrity uses exact issue body bytes", () => {
  const body = "## Motivation\n\nCaptured discussion.\n";
  const url = "https://github.com/zcash/zips/issues/1302";
  assert.equal(
    issueBodyHash(body),
    createHash("sha256").update(body, "utf8").digest("hex"),
  );
  const entry = {
    url,
    number: 1302,
    title: "Issue",
    body,
    updatedAt: "2026-07-05T21:00:43Z",
    fetchedAt: "2026-09-23T00:00:00Z",
    contentHash: issueBodyHash(body),
  };
  assert.deepEqual(
    validateIssueSnapshotFile({ version: 1, issues: { [url]: entry } }),
    { version: 1, issues: { [url]: entry } },
  );
  assert.throws(() =>
    validateIssueSnapshotFile({
      version: 1,
      issues: { [url]: { ...entry, body: body + "tampered" } },
    }),
  );
});

const issueUrl = "https://github.com/zcash/zips/issues/1302";
const issueBody = "Captured discussion.\n";

function validEntry(): Record<string, unknown> {
  return {
    url: issueUrl,
    number: 1302,
    title: "Issue",
    body: issueBody,
    updatedAt: "2026-07-05T21:00:43Z",
    fetchedAt: "2026-09-23T00:00:00.000Z",
    contentHash: createHash("sha256").update(issueBody, "utf8").digest("hex"),
  };
}

function snapshotFile(
  entry: unknown = validEntry(),
  key = issueUrl,
): Record<string, unknown> {
  return { version: 1, issues: { [key]: entry } };
}

function entryWithout(field: string): Record<string, unknown> {
  const entry = validEntry();
  delete entry[field];
  return entry;
}

// Catches acceptance of malformed, ambiguous, inherited, or internally inconsistent cache data.
test("snapshot validation rejects every malformed contract shape", () => {
  const otherUrl = "https://github.com/zcash/zips/issues/1303";
  const emptyBodyEntry = {
    ...validEntry(),
    body: "",
    contentHash: createHash("sha256").update("", "utf8").digest("hex"),
  };
  const inheritedTitle = Object.assign(Object.create({ title: "Inherited" }), validEntry());
  delete inheritedTitle.title;

  const invalid: Array<[string, unknown]> = [
    ["unknown version", { version: 2, issues: {} }],
    ["array issue map", { version: 1, issues: [] }],
    ["nonobject entry", snapshotFile(null)],
    ["mismatched URL key", snapshotFile(validEntry(), otherUrl)],
    ["noncanonical entry URL", snapshotFile({ ...validEntry(), url: `${issueUrl}?x=1` })],
    ["mismatched issue number", snapshotFile({ ...validEntry(), number: 1303 })],
    [
      "unsafe issue number",
      snapshotFile({ ...validEntry(), number: Number.MAX_SAFE_INTEGER + 1 }),
    ],
    ["empty title", snapshotFile({ ...validEntry(), title: "" })],
    ["empty body", snapshotFile(emptyBodyEntry)],
    ["invalid updated date", snapshotFile({ ...validEntry(), updatedAt: "not-a-date" })],
    ["impossible updated date", snapshotFile({ ...validEntry(), updatedAt: "2026-02-30T00:00:00Z" })],
    ["invalid fetched date", snapshotFile({ ...validEntry(), fetchedAt: "yesterday" })],
    ["nonhex hash", snapshotFile({ ...validEntry(), contentHash: "g".repeat(64) })],
    ["inherited field", snapshotFile(inheritedTitle)],
    ...[
      "url",
      "number",
      "title",
      "body",
      "updatedAt",
      "fetchedAt",
      "contentHash",
    ].map((field): [string, unknown] => [
      `absent ${field}`,
      snapshotFile(entryWithout(field)),
    ]),
  ];

  for (const [name, value] of invalid) {
    assert.throws(() => validateIssueSnapshotFile(value), name);
  }
});

// Catches non-atomic or lossy serialization and failure to validate data read back from disk.
test("snapshot storage round-trips formatted validated JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-issue-snapshots-"));
  try {
    const path = join(dir, "issues.json");
    const snapshots = validateIssueSnapshotFile(snapshotFile());

    writeIssueSnapshots(path, snapshots);

    assert.equal(readFileSync(path, "utf8"), `${JSON.stringify(snapshots, null, 2)}\n`);
    assert.deepEqual(readIssueSnapshots(path), snapshots);
    assert.deepEqual(readdirSync(dir), ["issues.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Catches checked-in snapshots receiving filesystem or traversal order instead of a stable URL order.
test("snapshot storage writes entries sorted by canonical URL", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-issue-snapshots-"));
  try {
    const path = join(dir, "issues.json");
    const secondUrl = "https://github.com/zcash/zips/issues/1303";
    const secondBody = "Second captured discussion.\n";
    const second = {
      ...validEntry(),
      url: secondUrl,
      number: 1303,
      body: secondBody,
      contentHash: issueBodyHash(secondBody),
    };
    const snapshots = validateIssueSnapshotFile({
      version: 1,
      issues: { [secondUrl]: second, [issueUrl]: validEntry() },
    });

    writeIssueSnapshots(path, snapshots);

    assert.deepEqual(Object.keys(readIssueSnapshots(path).issues), [issueUrl, secondUrl]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Catches treating a first-run missing cache as a fatal error.
test("reading an absent snapshot file returns an empty version 1 file", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-issue-snapshots-"));
  try {
    assert.deepEqual(readIssueSnapshots(join(dir, "missing.json")), {
      version: 1,
      issues: {},
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Catches broad read error handling that silently discards a corrupted cache.
test("reading malformed snapshot JSON throws", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-issue-snapshots-"));
  try {
    const path = join(dir, "issues.json");
    writeFileSync(path, "{ definitely not JSON\n", "utf8");
    assert.throws(() => readIssueSnapshots(path), SyntaxError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Catches truncating a valid old cache before rejecting invalid replacement data.
test("an invalid snapshot write preserves the old file bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-issue-snapshots-"));
  try {
    const path = join(dir, "issues.json");
    const oldBytes = "old snapshot bytes must survive\n";
    writeFileSync(path, oldBytes, "utf8");
    const invalid = snapshotFile({ ...validEntry(), body: "tampered" });

    assert.throws(() =>
      writeIssueSnapshots(path, invalid as unknown as IssueSnapshotFile),
    );
    assert.equal(readFileSync(path, "utf8"), oldBytes);
    assert.deepEqual(readdirSync(dir), ["issues.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
