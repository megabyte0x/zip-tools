import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasSubstantiveBody } from "../src/sourceBody.ts";

// Catches the production fallback treating ZIP 2007's metadata-only source as proposal content.
test("ZIP 2007 metadata is not proposal content", () => {
  const source = readFileSync(
    new URL("../../../submodule/zips/zips/zip-2007.md", import.meta.url),
    "utf8",
  );
  assert.equal(hasSubstantiveBody(source), false);
  assert.equal(hasSubstantiveBody(source + "\nOne sentence.\n"), true);
});

// Catches blank snapshots becoming bodies and short, headerless content being discarded.
test("conservative detection preserves short prose", () => {
  assert.equal(hasSubstantiveBody(null), false);
  assert.equal(hasSubstantiveBody(" \r\n"), false);
  assert.equal(hasSubstantiveBody("Short."), true);
  assert.equal(hasSubstantiveBody("::\n\n  ZIP: 1\n  Title: T\n"), false);
  assert.equal(
    hasSubstantiveBody("::\n\n  ZIP: 1\n  Title: T\n\nAbstract\n========\n\nX"),
    true,
  );
  assert.equal(hasSubstantiveBody("---\nZIP: 1\nTitle: T\n---\n"), false);
  assert.equal(hasSubstantiveBody("---\nZIP: 1\nTitle: T\n---\nX"), true);
  assert.equal(hasSubstantiveBody("Meaning: this is prose, not metadata."), true);
});

// Catches BOM and CRLF handling from leaving a recognized RST preamble in the body.
test("normalizes BOM and CRLF before scanning RST metadata", () => {
  assert.equal(
    hasSubstantiveBody("\uFEFF::\r\n\r\n  ZIP: 1\r\n  Title: T\r\n"),
    false,
  );
});

// Catches indented Markdown RFC-822 metadata from bypassing the metadata-only classification.
test("recognizes indented Markdown metadata", () => {
  assert.equal(hasSubstantiveBody("    ZIP: 1\n    Title: T\n"), false);
  assert.equal(
    hasSubstantiveBody("  ---\n  ZIP: 1\n  Title: T\n  ---\n"),
    false,
  );
});

// Catches RFC-822 continuation lines being mistaken for a substantive RST body.
test("consumes owner continuation lines deeper than their field", () => {
  assert.equal(
    hasSubstantiveBody("::\n\n  ZIP: 1\n  Title: T\n  Owners: First Owner\n    Second Owner\n"),
    false,
  );
});

// Catches malformed front matter being swallowed instead of retained as ambiguous content.
test("preserves unclosed front matter as substantive", () => {
  assert.equal(hasSubstantiveBody("---\nZIP: 1\nTitle: T\n"), true);
});

// Catches unrecognized preamble-like blocks and fenced code being discarded as metadata.
test("preserves unrecognized preambles and fenced code as substantive", () => {
  assert.equal(hasSubstantiveBody("::\n\n  Identifier: 1\n  Title: T\n"), true);
  assert.equal(hasSubstantiveBody("```yaml\nZIP: 1\nTitle: T\n```\n"), true);
});

// Catches non-textual Markdown content after metadata being ignored as an empty body.
test("treats an image-only body as substantive", () => {
  assert.equal(
    hasSubstantiveBody("---\nZIP: 1\nTitle: T\n---\n![Diagram](zip-1/image.png)\n"),
    true,
  );
});
