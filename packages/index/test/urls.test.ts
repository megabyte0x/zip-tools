import { test } from "node:test";
import assert from "node:assert/strict";
import { officialUrl, githubBlobUrl, padZip } from "../src/urls.ts";

test("padZip zero-pads to 4", () => {
  assert.equal(padZip(0), "0000");
  assert.equal(padZip(32), "0032");
  assert.equal(padZip(2005), "2005");
});

test("officialUrl for numbered ZIP", () => {
  assert.equal(officialUrl(32, "zip-0032"), "https://zips.z.cash/zip-0032");
  assert.equal(officialUrl(0, "zip-0000"), "https://zips.z.cash/zip-0000");
});

test("officialUrl for draft slug", () => {
  assert.equal(
    officialUrl(null, "draft-arya-deploy-nu7"),
    "https://zips.z.cash/draft-arya-deploy-nu7",
  );
});

test("githubBlobUrl uses pin SHA and sourcePath", () => {
  assert.equal(
    githubBlobUrl("abc123", "zips/zip-0032.rst"),
    "https://github.com/zcash/zips/blob/abc123/zips/zip-0032.rst",
  );
});
