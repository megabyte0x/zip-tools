import assert from "node:assert/strict";
import { test } from "node:test";
import { supportedIssueUrl } from "./readerSource.ts";

test("supportedIssueUrl accepts only canonical positive zcash zips issue URLs", () => {
  assert.equal(
    supportedIssueUrl("https://github.com/zcash/zips/issues/1302"),
    "https://github.com/zcash/zips/issues/1302",
  );
  assert.equal(
    supportedIssueUrl("https://github.com/zcash/zips/issues/9007199254740991"),
    "https://github.com/zcash/zips/issues/9007199254740991",
  );

  for (const value of [
    null,
    undefined,
    "",
    "http://github.com/zcash/zips/issues/1302",
    "https://github.com/Zcash/zips/issues/1302",
    "https://github.com/zcash/zips/issues/0",
    "https://github.com/zcash/zips/issues/01302",
    "https://github.com/zcash/zips/issues/1302/",
    "https://github.com/zcash/zips/issues/1302#discussion",
    "https://github.com/zcash/zips/pull/1302",
    "https://github.com/zcash/zips/issues/9007199254740992",
  ]) {
    assert.equal(supportedIssueUrl(value), null);
  }
});
