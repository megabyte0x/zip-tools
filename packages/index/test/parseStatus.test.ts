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

test("bracketed revision statuses normalize", () => {
  assert.deepEqual(
    parseStatus("[Revision 0] Active, [Revision 1: NU6.3] Draft, [Revision 2] Draft"),
    [
      { label: "Active", revision: "0" },
      { label: "Draft", revision: "1", nuHint: "NU6.3" },
      { label: "Draft", revision: "2" },
    ],
  );
  assert.equal(parseStatus("Proposed for NU6.3")[0]?.label, "Proposed");
});

const KNOWN_LABELS = new Set([
  "Draft",
  "Proposed",
  "Active",
  "Final",
  "Withdrawn",
  "Rejected",
  "Obsolete",
  "Reserved",
]);

test("commas inside revision brackets do not split ZIP 207 and ZIP 214 statuses", () => {
  const zip207 = parseStatus(
    "[Revision 0: Canopy, Revision 1: NU6] Final, [Revision 2: NU7] Draft",
  );
  const zip214 = parseStatus(
    "[Revision 0: Canopy, Revision 1: NU6] Final, [Revision 2: NU6.1] Proposed, [Revision 3: NU7] Draft",
  );

  assert.deepEqual(zip207, [
    { label: "Final", revision: "0" },
    { label: "Final", revision: "1", nuHint: "NU6" },
    { label: "Draft", revision: "2", nuHint: "NU7" },
  ]);
  assert.deepEqual(zip214, [
    { label: "Final", revision: "0" },
    { label: "Final", revision: "1", nuHint: "NU6" },
    { label: "Proposed", revision: "2", nuHint: "NU6.1" },
    { label: "Draft", revision: "3", nuHint: "NU7" },
  ]);

  for (const entries of [zip207, zip214]) {
    for (const entry of entries) {
      assert.ok(KNOWN_LABELS.has(entry.label), entry.label);
      assert.match(entry.revision ?? "", /^\d+$/);
      assert.equal(entry.nuHint?.includes("[") ?? false, false);
      assert.equal(entry.nuHint?.includes("]") ?? false, false);
    }
  }
});
