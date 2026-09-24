import assert from "node:assert/strict";
import { test } from "node:test";
import { findGraphNode } from "./graphSearch.ts";

const nodes = [
  { id: 32, title: "Wallets", status: "Final", unassigned: false, citesCount: 0, citedByCount: 0 },
  {
    id: 317,
    title: "Proportional Transfer Fee Mechanism",
    status: "Draft",
    unassigned: false,
    citesCount: 0,
    citedByCount: 0,
  },
];

test("findGraphNode finds exact ZIP-number queries", () => {
  assert.equal(findGraphNode(nodes, "ZIP 32")?.id, 32);
  assert.equal(findGraphNode(nodes, "32")?.id, 32);
});

test("findGraphNode finds titles case-insensitively", () => {
  assert.equal(findGraphNode(nodes, " proportional transfer fee mechanism ")?.id, 317);
});

test("findGraphNode returns undefined for no match or an empty graph", () => {
  assert.equal(findGraphNode(nodes, "ZIP 999"), undefined);
  assert.equal(findGraphNode(nodes, "Wallet"), undefined);
  assert.equal(findGraphNode([], "32"), undefined);
  assert.equal(findGraphNode(nodes, "  "), undefined);
});
