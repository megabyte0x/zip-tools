import { test } from "node:test";
import assert from "node:assert/strict";
import { parseZipsQuery } from "./zipsQuery.ts";

test("parseZipsQuery reads q and kind=draft", () => {
  assert.deepEqual(parseZipsQuery("?q=32&kind=draft"), { text: "32", kind: "draft" });
});

test("parseZipsQuery unknown kind is empty", () => {
  assert.deepEqual(parseZipsQuery("?kind=nope"), { text: "", kind: "" });
});
