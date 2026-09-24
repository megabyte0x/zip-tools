import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRAPH_DETAILS_IDLE, escapeHtml, graphNodeFacts, graphNodeHeading, graphNodeLabel, graphTooltipHtml,
} from "./graphLabels.ts";

const assigned = { id: 32, title: "Shielded HD Wallets", unassigned: false, status: "Final", citesCount: 3, citedByCount: 12 };
const dangling = { id: 99, title: "Unassigned", unassigned: true, status: "", citesCount: 0, citedByCount: 1 };

test("graph labels name the node number, heading, and facts", () => {
  assert.equal(graphNodeLabel(assigned), "32");
  assert.equal(graphNodeHeading(assigned), "ZIP 32: Shielded HD Wallets");
  assert.equal(graphNodeHeading(dangling), "99 — Unassigned");
  assert.equal(graphNodeFacts(assigned), "Final · Cites 3 · Cited by 12");
  assert.equal(graphNodeFacts(dangling), "Cites 0 · Cited by 1");
  assert.equal(GRAPH_DETAILS_IDLE, "Hover or tap a node to see its title and citations.");
});

test("graph facts never use Requires copy", () => {
  assert.doesNotMatch(graphNodeFacts(assigned), /requires/i);
});

test("graph tooltip HTML escapes titles", () => {
  const html = graphTooltipHtml({ ...assigned, id: 245, title: "Digests & <Signature> \"Validation\"" });
  assert.equal(
    html,
    "<strong>ZIP 245: Digests &amp; &lt;Signature&gt; &quot;Validation&quot;</strong><br><span>Final · Cites 3 · Cited by 12</span>",
  );
  assert.equal(escapeHtml("a'b"), "a&#39;b");
});
