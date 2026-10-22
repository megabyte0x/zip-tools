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
  // ZIPs also link rendered pages and the spec PDFs that only the official site publishes.
  assert.equal(readerProposalHref("zip-0226.html#circuit-statement"), "/zip/226#circuit-statement");
  assert.equal(
    readerProposalHref("protocol/protocol.pdf#networks"),
    "https://zips.z.cash/protocol/protocol.pdf#networks",
  );
});

test("readerProposalHref preserves fragments and safe external URLs but blocks unsafe schemes", () => {
  assert.equal(readerProposalHref("#security"), "#security");
  assert.equal(readerProposalHref("https://example.com/spec?q=1#part"), "https://example.com/spec?q=1#part");
  assert.equal(readerProposalHref("//example.com/zip-0032.rst#abstract"), "//example.com/zip-0032.rst#abstract");
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
  // Upstream builds rendered/ by copying the tracked static/ directory.
  assert.equal(
    readerAssetUrl(zip, "../../rendered/assets/images/zip-0227-key-components-zsa.png"),
    "https://raw.githubusercontent.com/zcash/zips/deadbeef/static/assets/images/zip-0227-key-components-zsa.png",
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

test("readerAssetUrl resolves issue assets from a canonical issue instead of the pinned ZIP", () => {
  const zip = makeZip({
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/zip-2007.md",
    bodySource: {
      kind: "github-issue",
      url: "https://github.com/zcash/zips/issues/1302",
      title: "Fixture",
      updatedAt: "2026-07-05T21:00:43Z",
      fetchedAt: "2026-09-23T00:00:00Z",
      contentHash: "a".repeat(64),
    },
  });

  assert.equal(
    readerAssetUrl(zip, "diagram.png"),
    "https://github.com/zcash/zips/issues/diagram.png",
  );
  assert.equal(
    readerAssetUrl(zip, "https://github.com/user-attachments/assets/123/diagram.png"),
    "https://github.com/user-attachments/assets/123/diagram.png",
  );
  assert.equal(readerAssetUrl(zip, "javascript:alert(1)"), "");
});

test("readerAssetUrl rejects relative issue assets when the issue URL is invalid", () => {
  const zip = makeZip({
    githubUrl: "https://github.com/zcash/zips/blob/deadbeef/zips/zip-2007.md",
    bodySource: {
      kind: "github-issue",
      url: "https://github.com/zcash/zips/issues/01302",
      title: "Invalid fixture",
      updatedAt: "2026-07-05T21:00:43Z",
      fetchedAt: "2026-09-23T00:00:00Z",
      contentHash: "a".repeat(64),
    },
  });

  assert.equal(readerAssetUrl(zip, "diagram.png"), "");
  assert.equal(
    readerAssetUrl(zip, "https://github.com/user-attachments/assets/123/diagram.png"),
    "https://github.com/user-attachments/assets/123/diagram.png",
  );
});
