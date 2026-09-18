import { test } from "node:test";
import assert from "node:assert/strict";
import { neighborhood } from "./neighborhood.ts";
import type { ZipIndexFile, ZipRecord } from "./types.ts";
import type { GraphEdge, GraphNode } from "./neighborhood.ts";

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

const zip0 = stubZip({
  id: "0",
  number: 0,
  slug: "zip-0000",
  title: "ZIP 0",
  citations: [32],
});

const zip1 = stubZip({
  id: "1",
  number: 1,
  slug: "zip-0001",
  title: "ZIP 1",
  citations: [0],
});

const zip32 = stubZip({
  id: "32",
  number: 32,
  slug: "zip-0032",
  title: "Shielded Hierarchical Deterministic Wallets",
  citedBy: [0],
});

const zip229 = stubZip({
  id: "229",
  number: 229,
  slug: "zip-0229",
  title: "ZIP 229",
  citations: [224],
});

const index: ZipIndexFile = {
  snapshot: { sha: "abc", date: "2026-09-18", url: "https://example.test" },
  zips: [zip0, zip1, zip32, zip229],
  nus: [],
  dangling: [224],
};

function sortedNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => a.number - b.number);
}

function sortedEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => a.from - b.from || a.to - b.to);
}

test("neighborhood depth 1 from ZIP 0 includes its citation ZIP 32 and cited-by ZIP 1", () => {
  const result = neighborhood(index, 0, 1);
  assert.deepEqual(sortedNodes(result.nodes), [
    { number: 0, title: "ZIP 0", unassigned: false },
    { number: 1, title: "ZIP 1", unassigned: false },
    { number: 32, title: "Shielded Hierarchical Deterministic Wallets", unassigned: false },
  ]);
  assert.deepEqual(sortedEdges(result.edges), [
    { from: 0, to: 32 },
    { from: 1, to: 0 },
  ]);
});

test("neighborhood depth 1 from ZIP 229 includes dangling 224 as Unassigned", () => {
  const result = neighborhood(index, 229, 1);
  assert.deepEqual(sortedNodes(result.nodes), [
    { number: 224, title: "Unassigned", unassigned: true },
    { number: 229, title: "ZIP 229", unassigned: false },
  ]);
  assert.deepEqual(sortedEdges(result.edges), [{ from: 229, to: 224 }]);
});

test("neighborhood depth 1 from ZIP 32 includes inbound cited-by ZIP 0", () => {
  const result = neighborhood(index, 32, 1);
  assert.deepEqual(sortedNodes(result.nodes), [
    { number: 0, title: "ZIP 0", unassigned: false },
    { number: 32, title: "Shielded Hierarchical Deterministic Wallets", unassigned: false },
  ]);
  assert.deepEqual(sortedEdges(result.edges), [{ from: 0, to: 32 }]);
});

test("neighborhood depth 2 from ZIP 32 includes one more hop", () => {
  const result = neighborhood(index, 32, 2);
  assert.deepEqual(sortedNodes(result.nodes), [
    { number: 0, title: "ZIP 0", unassigned: false },
    { number: 1, title: "ZIP 1", unassigned: false },
    { number: 32, title: "Shielded Hierarchical Deterministic Wallets", unassigned: false },
  ]);
  assert.deepEqual(sortedEdges(result.edges), [
    { from: 0, to: 32 },
    { from: 1, to: 0 },
  ]);
});
