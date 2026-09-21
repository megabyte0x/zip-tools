import { test } from "node:test";
import assert from "node:assert/strict";
import { parseZipsQuery, serializeZipsQuery } from "./zipsQuery.ts";

const emptyQuery = {
  text: "",
  kind: "" as const,
  status: "",
  nuId: "",
  category: "",
  sort: "number" as const,
};

test("parseZipsQuery reads every supported explorer key", () => {
  assert.deepEqual(
    parseZipsQuery(
      "?q=Orchard&kind=numbered&status=Final&nu=nu6.3&category=Standards+Track&sort=title",
    ),
    {
      text: "Orchard",
      kind: "numbered",
      status: "Final",
      nuId: "nu6.3",
      category: "Standards Track",
      sort: "title",
    },
  );
});

test("parseZipsQuery defaults invalid kind and sort values", () => {
  assert.deepEqual(parseZipsQuery("?kind=nope&sort=recent"), emptyQuery);
});

test("serializeZipsQuery roundtrips supported values", () => {
  const query = parseZipsQuery(
    "?q=Orchard&kind=draft&status=Draft&nu=nu6.3&category=Informational&sort=title",
  );
  assert.deepEqual(parseZipsQuery(serializeZipsQuery(query)), query);
});

test("serializeZipsQuery omits empty and default values", () => {
  assert.equal(serializeZipsQuery(emptyQuery), "");
});

test("serializeZipsQuery preserves unrelated parameters and fragments", () => {
  assert.equal(
    serializeZipsQuery(
      { ...emptyQuery, text: "Orchard", nuId: "nu6.3", sort: "title" },
      "?view=compact&q=old#results",
    ),
    "?view=compact&q=Orchard&nu=nu6.3&sort=title#results",
  );
});

test("serializeZipsQuery removes stale explorer parameters", () => {
  assert.equal(
    serializeZipsQuery(emptyQuery, "?q=old&kind=draft&status=Draft&nu=nu6&category=Core&sort=title&keep=1"),
    "?keep=1",
  );
});
