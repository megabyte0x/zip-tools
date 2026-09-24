import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPH_HELP, GRAPH_UNAVAILABLE, graphRecords } from "./graphFallback.ts";
import { makeZip } from "./test-zip.ts";

test("graphRecords builds assigned and true dangling citation edges", () => {
  const g = graphRecords(
    [
      makeZip({ number: 1, citations: [2, 99], status: [{ label: "Final" }] }),
      makeZip({ number: 2, title: "Second ZIP" }),
    ],
    [99],
  );
  assert.equal(g.nodes.some((n) => n.id === 99 && n.unassigned), true);
  assert.deepEqual(g.links, [{ source: 1, target: 2 }, { source: 1, target: 99 }]);
});

test("graphRecords omits edges to assigned ZIPs excluded by a filter", () => {
  const g = graphRecords(
    [makeZip({ number: 1, citations: [2, 99], status: [{ label: "Final" }] })],
    [99],
  );
  assert.deepEqual(g.links, [{ source: 1, target: 99 }]);
  assert.equal(g.nodes.some((node) => node.id === 2), false);
  assert.equal(g.nodes.some((node) => node.id === 99 && node.unassigned), true);
});

test("graphRecords drops dangling with no edge to remaining zips", () => {
  const g = graphRecords(
    [makeZip({ number: 1, citations: [99], status: [{ label: "Final" }] })],
    [99, 88],
  );
  assert.equal(g.nodes.some((n) => n.id === 99 && n.unassigned), true);
  assert.equal(g.nodes.some((n) => n.id === 88), false);
});

test("graphRecords returns an empty graph for empty filtered membership", () => {
  assert.deepEqual(graphRecords([], [99]), { nodes: [], links: [] });
});

test("graph copy constants match spec", () => {
  assert.equal(GRAPH_HELP, "Left-click: rotate, Mouse-wheel: zoom, Right-click: pan");
  assert.equal(GRAPH_UNAVAILABLE, "Citation graph is unavailable in this browser.");
});

test("graphRecords counts cites and cited-by from emitted links only", () => {
  const g = graphRecords(
    [
      makeZip({ number: 1, citations: [2, 3, 99] }),
      makeZip({ number: 2, citations: [3] }),
      makeZip({ number: 3 }),
    ],
    [99],
  );
  const byId = new Map(g.nodes.map((node) => [node.id, node]));
  assert.deepEqual([byId.get(1)!.citesCount, byId.get(1)!.citedByCount], [3, 0]);
  assert.deepEqual([byId.get(3)!.citesCount, byId.get(3)!.citedByCount], [0, 2]);
  assert.deepEqual([byId.get(99)!.citesCount, byId.get(99)!.citedByCount], [0, 1]);
});

test("graphRecords counts ignore citations to assigned ZIPs removed by a filter", () => {
  const g = graphRecords([makeZip({ number: 1, citations: [2] })], []);
  assert.equal(g.nodes[0].citesCount, 0);
});
