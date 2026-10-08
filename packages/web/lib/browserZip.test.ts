import assert from "node:assert/strict";
import { test } from "node:test";
import { browserZip } from "./browserZip.ts";
import { filterZips } from "./filter.ts";
import { graphRecords } from "./graphFallback.ts";
import { searchSuggestions } from "./searchSuggest.ts";
import { makeZip } from "./test-zip.ts";

test("browser records omit article data while preserving search, filters, and citations", () => {
  const zips = [
    makeZip({
      id: "32", number: 32, title: "Shielded wallets", body: "Proposal body",
      owners: [{ name: "Daira", email: "daira@example.com" }],
      status: [{ label: "Final", revision: "2" }], statusRaw: "Revision 2: Final",
      category: "Standards Track", nuIds: ["nu6.3"], citations: [317, 99],
    }),
    makeZip({ id: "317", number: 317, title: "Fee mechanism" }),
    makeZip({ id: "draft-foo", number: null, slug: "draft-foo", title: "Shielded draft" }),
  ];
  const records = zips.map(browserZip);
  assert.deepEqual(Object.keys(records[0]).sort(), [
    "category", "citations", "id", "nuIds", "number", "owners", "slug", "status", "statusRaw", "title",
  ]);
  assert.deepEqual(records[0].owners, [{ name: "Daira" }]);
  for (const text of ["shielded", "daira", "317", "draft"]) {
    assert.deepEqual(searchSuggestions(records, text), searchSuggestions(zips, text));
  }
  for (const query of [{ status: "Final" }, { nuId: "nu6.3" }, { category: "Standards Track" }]) {
    assert.deepEqual(filterZips(records, query), filterZips(zips, query).map(browserZip));
  }
  assert.deepEqual(graphRecords(records, [99]), graphRecords(zips, [99]));
  assert.equal(zips[0].body, "Proposal body");
});
