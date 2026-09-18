import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPH_HELP, GRAPH_UNAVAILABLE, graphRecords } from "./graphFallback.ts";
import { makeZip } from "./test-zip.ts";

test("graphRecords builds cites edges and dangling nodes", () => {
  const g = graphRecords(
    [makeZip({ number: 1, citations: [2, 99], status: [{ label: "Final" }] })],
    [99],
  );
  assert.equal(g.nodes.some((n) => n.id === 99 && n.unassigned), true);
  assert.deepEqual(g.links, [{ source: 1, target: 2 }, { source: 1, target: 99 }]);
});

test("graph copy constants match spec", () => {
  assert.equal(GRAPH_HELP, "Left-click: rotate, Mouse-wheel: zoom, Right-click: pan");
  assert.equal(GRAPH_UNAVAILABLE, "Citation graph is unavailable in this browser.");
});
