import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { prepareReader } from "./prepareReader.ts";
import type { ZipIndexFile } from "./types.ts";

type Node = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };

const INDEX = new URL("../data/zip-index.json", import.meta.url);

/** Visible prose only: rendered KaTeX, code and preformatted blocks are skipped. */
function visibleText(node: Node): string {
  if (node.type === "text") return node.value ?? "";
  const className = node.properties?.className;
  const classes = Array.isArray(className) ? className.map(String) : [];
  if (classes.some((name) => name.startsWith("katex"))) return "";
  if (node.tagName === "code" || node.tagName === "pre") return "";
  return (node.children ?? []).map(visibleText).join(" ");
}

const LEAKS: Array<[string, RegExp]> = [
  ["tex command", /\\?\b(?:mathsf|mathrm|mathbb|mathcal|textsf|begin\{|frac\{|cdot\b)/],
  ["tex delimiter", /\$[^$\s][^$]*\$|\\\(|\\\[/],
  ["rst role", /:(?:math|sup|sub|ref|doc):`/],
  ["rst directive", /(?:^|\s)\.\. [a-z-]+::/],
  ["rst link", /`[^`]+ <https?:[^>]+>`_/],
];

test("every ZIP in the built index renders without leaked TeX or raw RST", { skip: !existsSync(INDEX) }, async () => {
  const index = JSON.parse(readFileSync(INDEX, "utf8")) as ZipIndexFile;
  const failures: string[] = [];
  for (const zip of index.zips) {
    const doc = await prepareReader(zip);
    const tree = unified().use(rehypeParse, { fragment: true }).parse(doc.html) as Node;
    const text = visibleText(tree).replace(/\s+/g, " ");
    for (const [kind, pattern] of LEAKS) {
      const match = pattern.exec(text);
      if (match) {
        const at = Math.max(0, match.index - 30);
        failures.push(`${zip.id} [${doc.mode}] ${kind}: …${text.slice(at, match.index + 50)}…`);
      }
    }
  }
  assert.equal(failures.length, 0, `${failures.length} leaks:\n${failures.join("\n")}`);
});
