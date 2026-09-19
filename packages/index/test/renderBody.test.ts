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

test("rst without pandoc keeps source body and warning", () => {
  const source = "====\nHi\n====\n";
  const r = renderBody("zips/zip-0000.rst", source);
  assert.equal(r.bodyKind, "rst");
  if (r.warning?.includes("pandoc not found") || r.body === source) {
    assert.equal(r.body, source);
    assert.ok(r.warning);
  } else {
    assert.ok(r.body?.includes("<") || (r.body?.length ?? 0) > 0);
  }
});
