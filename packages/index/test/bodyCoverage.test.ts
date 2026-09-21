import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBody } from "../src/renderBody.ts";

const sourceDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../submodule/zips/zips",
);

test("all real source-backed proposals retain nonempty bodies when RST conversion fails", () => {
  const sourceNames = readdirSync(sourceDir).filter(
    (name) =>
      (name.startsWith("zip-") || name.startsWith("draft-")) &&
      !name.startsWith("zip-guide") &&
      !name.startsWith("zip-template") &&
      (name.endsWith(".rst") || name.endsWith(".md")),
  );
  assert.ok(sourceNames.length > 0, "expected real proposal sources");

  const retained = sourceNames.filter((name) => {
    const source = readFileSync(join(sourceDir, name), "utf8");
    const rendered = renderBody(`zips/${name}`, source, () => ({
      body: null,
      warning: "forced converter failure",
    }));
    return source.trim().length > 0 && (rendered.body?.trim().length ?? 0) > 0;
  });

  assert.equal(retained.length, sourceNames.length);
});
