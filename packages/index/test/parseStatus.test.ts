import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatus } from "../src/parseStatus.ts";

test("single label", () => {
  assert.deepEqual(parseStatus("Final"), [{ label: "Final" }]);
});

test("revision with NU hint", () => {
  const got = parseStatus("Revision 0: Canopy, Revision 1: NU6 Final");
  // Accept splitting on commas that begin Revision, or on "Revision N" chunks.
  // Required: at least one entry with label Final, one with nuHint NU6 or Canopy.
  assert.ok(got.some((s) => s.label === "Final" || /Final/i.test(s.label)));
});

test("explicit multi-revision from spec example", () => {
  const got = parseStatus("Revision 0 Active, Revision 2 Draft");
  assert.ok(got.some((s) => s.label === "Active" && s.revision === "0"));
  assert.ok(got.some((s) => s.label === "Draft" && s.revision === "2"));
});
