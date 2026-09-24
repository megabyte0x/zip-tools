import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { protectRstMath } from "../src/rstMath.ts";
import { renderBody } from "../src/renderBody.ts";

test("protectRstMath turns dollar math into :math: roles like upstream render.sh", () => {
  assert.equal(
    protectRstMath("Let $\\mathsf{a}_b$ be $x$ and \\$5 stays money."),
    "Let :math:`\\mathsf{a}_b` be :math:`x` and $5 stays money.",
  );
});

test("protectRstMath works line by line and leaves lone dollars alone", () => {
  assert.equal(protectRstMath("costs $5\nand $10"), "costs $5\nand $10");
  assert.equal(protectRstMath("a $x$\nb $y$"), "a :math:`x`\nb :math:`y`");
});

const hasPandoc = spawnSync("pandoc", ["--version"]).status === 0;

test("rst bodies keep TeX for inline, role and block math", { skip: !hasPandoc }, () => {
  const r = renderBody(
    "zips/zip-9999.rst",
    "Let $\\mathsf{a}_b$ and :math:`x^2`.\n\n.. math::\n    \\mathsf{f}(x) := 1\n",
  );
  assert.equal(r.bodyFormat, "html");
  assert.match(r.body ?? "", /<span class="math inline">\\\(\\mathsf\{a\}_b\\\)<\/span>/);
  assert.match(r.body ?? "", /<span class="math inline">\\\(x\^2\\\)<\/span>/);
  assert.match(r.body ?? "", /<span class="math display">\\\[\\mathsf\{f\}\(x\) := 1\\\]<\/span>/);
});
