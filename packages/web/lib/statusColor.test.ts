import { test } from "node:test";
import assert from "node:assert/strict";
import { statusColor } from "./statusColor.ts";

test("statusColor is stable and labeled statuses differ", () => {
  assert.notEqual(statusColor("Draft"), statusColor("Final"));
  assert.equal(statusColor("NotAStatus"), "#a3a091");
});
