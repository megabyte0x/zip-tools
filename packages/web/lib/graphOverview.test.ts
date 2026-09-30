import { test } from "node:test";
import assert from "node:assert/strict";
import type { GraphRecords } from "./graphFallback.ts";
import { featuredGraphLabelIds, overviewGraphNodeIds } from "./graphOverview.ts";

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

test("featured labels prioritize assigned hubs", () => {
  const crowded: GraphRecords = {
    nodes: [
      ...Array.from({ length: 15 }, (_, index) => ({
        id: 15 - index,
        title: `ZIP ${15 - index}`,
        unassigned: false,
        status: "Draft",
        citesCount: 15 - index,
        citedByCount: 0,
      })),
      { id: 99, title: "Unassigned", unassigned: true, status: "", citesCount: 100, citedByCount: 100 },
    ],
    links: [],
  };
  const labels = featuredGraphLabelIds(crowded);
  assert.deepEqual([...labels], [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  assert.equal(labels.size <= 12, true);
  assert.equal(labels.has(99), false);
  assert.deepEqual([...featuredGraphLabelIds(crowded)], [...labels]);
  assert.deepEqual(
    [...featuredGraphLabelIds({ nodes: [fixture.nodes[1], fixture.nodes[0]], links: [] })],
    [2, 4],
  );
});
