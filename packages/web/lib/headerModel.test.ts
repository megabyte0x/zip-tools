import { test } from "node:test";
import assert from "node:assert/strict";
import { headerModel } from "./headerModel.ts";
import { makeZip } from "./test-zip.ts";

test("headerModel browse count equals every listed record; drafts counted separately", () => {
  const model = headerModel({
    zips: [
      makeZip({ number: 32 }),
      makeZip({ id: "33", number: 33 }),
      makeZip({ id: "d", number: null, slug: "draft-foo" }),
    ],
    nus: [
      { id: "nu7", title: "NU7", kind: "candidate", deploymentZip: null, zips: [] },
      { id: "nu6.2", title: "NU6.2", kind: "settled", deploymentZip: 257, zips: [257] },
    ],
  });
  assert.equal(model.browseCount, 3);
  assert.equal(model.draftCount, 1);
  assert.equal("zipCount" in model, false);
  assert.deepEqual(model.nus, [
    { id: "nu6.2", href: "/nu/nu6.2" },
    { id: "nu7", href: "/nu/nu7" },
  ]);
});
