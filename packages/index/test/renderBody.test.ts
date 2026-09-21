import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBody } from "../src/renderBody.ts";

test("markdown numbered zip returns source with markdown format", () => {
  const r = renderBody("zips/zip-0229.md", "# Hello");
  assert.equal(r.bodyKind, "md");
  assert.equal(r.bodyFormat, "markdown");
  assert.equal(r.body, "# Hello");
});

test("draft markdown is draft kind with markdown format", () => {
  const r = renderBody("zips/draft-foo.md", "x");
  assert.equal(r.bodyKind, "draft");
  assert.equal(r.bodyFormat, "markdown");
  assert.equal(r.body, "x");
});

test("rst converter absence retains source with an explicit format", () => {
  const source = "Intro\n=====\n\nActual proposal text.";
  const r = renderBody(
    "zips/draft-test.rst",
    source,
    () => ({ body: null, warning: "pandoc not found" }),
  );
  assert.equal(r.body, source);
  assert.equal(r.bodyFormat, "rst-source");
  assert.equal(r.bodyKind, "draft");
  assert.equal(r.warning, "pandoc not found");
});

test("rst converter nonzero exit retains source and warning", () => {
  const source = "Proposal text";
  const r = renderBody("zips/zip-0032.rst", source, () => ({
    body: null,
    warning: "pandoc exited 7",
  }));
  assert.equal(r.body, source);
  assert.equal(r.bodyFormat, "rst-source");
  assert.equal(r.warning, "pandoc exited 7");
});

test("rst converter timeout retains source and warning", () => {
  const source = "Proposal text";
  const r = renderBody("zips/zip-0317.rst", source, () => ({
    body: null,
    warning: "spawnSync pandoc ETIMEDOUT",
  }));
  assert.equal(r.body, source);
  assert.equal(r.bodyFormat, "rst-source");
  assert.equal(r.warning, "spawnSync pandoc ETIMEDOUT");
});

test("successful rst conversion returns nonempty HTML", () => {
  const r = renderBody("zips/zip-0032.rst", "Intro\n=====", () => ({
    body: "<h1>Intro</h1>",
  }));
  assert.equal(r.body, "<h1>Intro</h1>");
  assert.equal(r.bodyFormat, "html");
  assert.equal(r.warning, undefined);
});

test("empty rst converter output retains source and adds a warning", () => {
  const source = "Intro\n=====";
  const r = renderBody("zips/zip-0032.rst", source, () => ({ body: "  " }));
  assert.equal(r.body, source);
  assert.equal(r.bodyFormat, "rst-source");
  assert.match(r.warning ?? "", /empty/i);
});

test("thrown rst converter error retains source and warning", () => {
  const source = "Intro\n=====";
  const r = renderBody("zips/zip-0032.rst", source, () => {
    throw new Error("converter crashed");
  });
  assert.equal(r.body, source);
  assert.equal(r.bodyFormat, "rst-source");
  assert.equal(r.warning, "converter crashed");
});
