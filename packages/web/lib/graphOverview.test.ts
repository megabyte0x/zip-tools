import { test } from "node:test";
import assert from "node:assert/strict";
import type { GraphRecords } from "./graphFallback.ts";
import { overviewGraphNodeIds } from "./graphOverview.ts";

const fixture: GraphRecords = {
  nodes: [
    { id: 2, title: "Two", unassigned: false, status: "Draft", citesCount: 0, citedByCount: 2 },
    { id: 4, title: "Four", unassigned: false, status: "Final", citesCount: 1, citedByCount: 1 },
    { id: 10, title: "Ten", unassigned: false, status: "Active", citesCount: 2, citedByCount: 1 },
    { id: 99, title: "Unassigned", unassigned: true, status: "", citesCount: 0, citedByCount: 8 },
  ],
  links: [],
};

test("overview selects cited assigned hubs", () => {
  assert.deepEqual([...overviewGraphNodeIds(fixture, 2)], [10, 2]);
  assert.deepEqual(
    [...overviewGraphNodeIds({ nodes: fixture.nodes.map((node) => ({ ...node, citesCount: 0, citedByCount: 0 })), links: [] })],
    [2, 4, 10, 99],
  );
});
