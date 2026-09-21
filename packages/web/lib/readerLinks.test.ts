import { test } from "node:test";
import assert from "node:assert/strict";
import { makeZip } from "./test-zip.ts";
import { readerAssetUrl, readerProposalHref } from "./readerLinks.ts";

test("readerProposalHref normalizes numbered and draft proposal references with fragments", () => {
  assert.equal(readerProposalHref("zip-0032.rst#abstract"), "/zip/32#abstract");
  assert.equal(readerProposalHref("/zip-0317#fees"), "/zip/317#fees");
  assert.equal(
    readerProposalHref("https://zips.z.cash/draft-example.md#motivation"),
    "/draft/draft-example#motivation",
  );
});

test("readerProposalHref preserves fragments and safe external URLs but blocks unsafe schemes", () => {
  assert.equal(readerProposalHref("#security"), "#security");
  assert.equal(readerProposalHref("https://example.com/spec?q=1#part"), "https://example.com/spec?q=1#part");
  assert.equal(readerProposalHref("mailto:alice@example.com"), "mailto:alice@example.com");
  assert.equal(readerProposalHref("javascript:alert(1)"), "#");
  assert.equal(readerProposalHref("data:text/html,bad"), "#");
  assert.equal(readerProposalHref("http://[invalid"), "#");
});

test("readerAssetUrl resolves nested relative assets against the pinned GitHub source", () => {
  const zip = makeZip({
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/nested/zip-0032.rst",
  });
  assert.equal(
    readerAssetUrl(zip, "../images/diagram.svg#layer"),
    "https://raw.githubusercontent.com/zcash/zips/deadbeef/zips/images/diagram.svg#layer",
  );
});

test("readerAssetUrl preserves safe absolute assets and rejects unsafe or unresolvable links", () => {
  const zip = makeZip({ githubUrl: "" });
  assert.equal(readerAssetUrl(zip, "https://cdn.example.com/image.png"), "https://cdn.example.com/image.png");
  assert.equal(readerAssetUrl(zip, "mailto:alice@example.com"), "");
  assert.equal(readerAssetUrl(zip, "javascript:alert(1)"), "");
  assert.equal(readerAssetUrl(zip, "images/local.png"), "");
});

test("readerAssetUrl does not let relative paths escape the pinned repository", () => {
  const zip = makeZip({
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/nested/zip-0032.rst",
  });
  assert.equal(readerAssetUrl(zip, "../../../../outside.svg"), "");
});
