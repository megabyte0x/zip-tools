import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldNavigateRow } from "./rowNavigation.ts";

const plain = { targetInteractive: false, modifier: false, button: 0, selection: "" };

test("a plain primary click on row whitespace navigates", () => {
  assert.equal(shouldNavigateRow(plain), true);
});

test("row clicks never hijack links, modifiers, other buttons or text selection", () => {
  assert.equal(shouldNavigateRow({ ...plain, targetInteractive: true }), false);
  assert.equal(shouldNavigateRow({ ...plain, modifier: true }), false);
  assert.equal(shouldNavigateRow({ ...plain, button: 1 }), false);
  assert.equal(shouldNavigateRow({ ...plain, selection: "Orchard" }), false);
  assert.equal(shouldNavigateRow({ ...plain, selection: "   " }), true);
});
