import { test } from "node:test";
import assert from "node:assert/strict";
import { headerModel, showHeaderSearch } from "./headerModel.ts";
import { makeZip } from "./test-zip.ts";

test("headerModel browse count equals every listed record; drafts counted separately", () => {
  const model = headerModel({
    zips: [
      makeZip({ number: 32 }),
      makeZip({ id: "33", number: 33 }),
      makeZip({ id: "d", number: null, slug: "draft-foo" }),
    ],
  });
  assert.equal(model.browseCount, 3);
  assert.equal(model.draftCount, 1);
  assert.equal("zipCount" in model, false);
});

test("header search hides where the page owns the search", () => {
  assert.equal(showHeaderSearch("/"), false);
  assert.equal(showHeaderSearch("/zips"), false);
  assert.equal(showHeaderSearch("/zip/32"), true);
  assert.equal(showHeaderSearch("/graph"), true);
  assert.equal(showHeaderSearch("/list"), true);
  assert.equal(showHeaderSearch("/zipsx"), true);
});
