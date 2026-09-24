import { test } from "node:test";
import assert from "node:assert/strict";
import { degradedSummary } from "../src/degraded.ts";

test("degradedSummary is silent when every RST body converted", () => {
  assert.equal(degradedSummary([{ bodyFormat: "html" }, { bodyFormat: "markdown" }]), null);
});

test("degradedSummary names the count and the fix when pandoc was missing", () => {
  const message = degradedSummary([{ bodyFormat: "rst-source" }, { bodyFormat: "rst-source" }, { bodyFormat: "html" }]);
  assert.match(message ?? "", /^warning: 2 RST ZIPs use the fallback renderer/);
  assert.match(message ?? "", /install pandoc/);
});
