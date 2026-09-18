import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDraft, resolveZip } from "./resolve.ts";
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

const draft = stubZip({
  id: "draft-arya-deploy-nu7",
  number: null,
  slug: "draft-arya-deploy-nu7",
  title: "Deploy NU7",
  bodyKind: "draft",
});

const index: ZipIndexFile = {
  snapshot: { sha: "abc", date: "2026-09-18", url: "https://example.test" },
  zips: [zip32, draft],
  nus: [],
  dangling: [],
};

test("resolveZip accepts 32", () => {
  assert.equal(resolveZip(index, "32"), zip32);
});

test("resolveZip accepts 032", () => {
  assert.equal(resolveZip(index, "032"), zip32);
});

test("resolveZip accepts 0032", () => {
  assert.equal(resolveZip(index, "0032"), zip32);
});

test("resolveZip accepts zip-0032", () => {
  assert.equal(resolveZip(index, "zip-0032"), zip32);
});

test("resolveZip accepts zip-32", () => {
  assert.equal(resolveZip(index, "zip-32"), zip32);
});

test("resolveZip returns null for an unknown id", () => {
  assert.equal(resolveZip(index, "9999"), null);
});

test("resolveDraft matches an exact slug", () => {
  assert.equal(resolveDraft(index, "draft-arya-deploy-nu7"), draft);
});

test("resolveDraft returns null for an unknown slug", () => {
  assert.equal(resolveDraft(index, "draft-missing"), null);
});
