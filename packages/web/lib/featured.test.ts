import { test } from "node:test";
import assert from "node:assert/strict";
import { featuredZips } from "./featured.ts";
import { makeZip } from "./test-zip.ts";

test("featuredZips unions candidate NU zips with recent created", () => {
  const index = {
    snapshot: { sha: "abc", date: "2026-01-01", url: "" },
    dangling: [],
    nus: [{ id: "nu7", title: "NU7", kind: "candidate" as const, deploymentZip: null, zips: [2] }],
    zips: [
      makeZip({ id: "1", number: 1, created: "2020-01-01", title: "Old" }),
      makeZip({ id: "2", number: 2, created: "2019-01-01", title: "Candidate" }),
      makeZip({ id: "3", number: 3, created: "2024-06-01", title: "New" }),
      makeZip({ id: "d", number: null, slug: "draft-x" }),
    ],
  };
  const featured = featuredZips(index, 1);
  assert.deepEqual(featured.map((z) => z.number), [3, 2]);
});
