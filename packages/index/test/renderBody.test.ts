import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBody } from "../src/renderBody.ts";

test("markdown numbered zip returns source", () => {
  const r = renderBody("zips/zip-0229.md", "# Hello");
  assert.equal(r.bodyKind, "md");
  assert.equal(r.body, "# Hello");
});

test("draft markdown is draft kind", () => {
  const r = renderBody("zips/draft-foo.md", "x");
  assert.equal(r.bodyKind, "draft");
  assert.equal(r.body, "x");
});

test("rst without pandoc or on failure returns null body and warning", () => {
  const r = renderBody("zips/zip-0000.rst", "====\nHi\n====\n");
  assert.equal(r.bodyKind, "rst");
  if (r.body === null) assert.ok(r.warning);
});
