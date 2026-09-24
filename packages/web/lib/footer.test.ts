import { test } from "node:test";
import assert from "node:assert/strict";
import { footerLabel } from "./footer.ts";

test("footerLabel reads as a sync line with short sha and day", () => {
  assert.equal(
    footerLabel({
      sha: "0fae783c1d2e3f40000000000000000000000000",
      date: "2026-09-15T10:04:00+00:00",
      url: "https://github.com/zcash/zips/commit/0fae783",
    }),
    "Synced from zcash/zips @ 0fae783 · Sep 15, 2026",
  );
});

test("footerLabel formats the commit day in UTC, not the local zone", () => {
  assert.equal(
    footerLabel({ sha: "abcdef1234", date: "2026-09-15T23:30:00-05:00", url: "" }),
    "Synced from zcash/zips @ abcdef1 · Sep 16, 2026",
  );
});

test("footerLabel drops the date part when the snapshot has no date", () => {
  assert.equal(footerLabel({ sha: "fixture", date: "", url: "" }), "Synced from zcash/zips @ fixture");
  assert.equal(footerLabel({ sha: "fixture", date: "not a date", url: "" }), "Synced from zcash/zips @ fixture");
});
