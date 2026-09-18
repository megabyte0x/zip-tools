import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOverlay } from "../src/overlay.ts";
import type { ZipRecord, NuOverlay } from "../src/types.ts";

function stub(n: number): ZipRecord {
  return {
    id: String(n),
    number: n,
    slug: `zip-${String(n).padStart(4, "0")}`,
    title: "t",
    status: [],
    statusRaw: "",
    category: null,
    owners: [],
    created: null,
    license: null,
    discussionsTo: null,
    nuIds: [],
    citations: [],
    citedBy: [],
    sourcePath: "",
    officialUrl: "",
    githubUrl: "",
    bodyKind: "md",
    body: null,
    parseWarnings: [],
  };
}

test("tags present zips and reports missing", () => {
  const overlay: NuOverlay = {
    nus: [{ id: "nu6.3", title: "NU6.3", kind: "candidate", deploymentZip: 258, zips: [258, 229] }],
  };
  const { zips, missing } = applyOverlay([stub(258)], overlay);
  assert.deepEqual(zips[0].nuIds, ["nu6.3"]);
  assert.deepEqual(missing, [{ nuId: "nu6.3", number: 229 }]);
});
