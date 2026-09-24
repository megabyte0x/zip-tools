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
  ["rst link", /`[^`]+ <[^>]+>`_/],
  ["rst literal", /``[^`]+``/],
  ["rst citation", /\[#?[\w-]+\]_/],
  ["rst substitution", /\|br\|/],
];

/**
 * Upstream source defects that render the same way on zips.z.cash; not converter bugs.
 * Keyed by "<zip id> <leak kind>" so any other leak in these ZIPs still fails.
 */
const KNOWN_SOURCE_ISSUES = new Map([
  ["155 tex delimiter", "literal ${PLACEHOLDER} text, zip-0155.rst:174"],
  ["208 tex command", "unclosed $ before 'as a function', zip-0208.rst:98"],
  ["228 tex command", "malformed ($i = 0$; ...; $i++$) math, zip-0228.rst:134"],
  ["228 rst role", "same malformed math, zip-0228.rst:134"],
  ["231 tex delimiter", "escaped \\$mathtt typo, zip-0231.md:399"],
  ["1012 tex delimiter", "dollar amounts ($700k/month), not math"],
]);

test("every ZIP in the built index renders without leaked TeX or raw RST", { skip: !existsSync(INDEX) }, async () => {
  const index = JSON.parse(readFileSync(INDEX, "utf8")) as ZipIndexFile;
  const failures: string[] = [];
  for (const zip of index.zips) {
    const doc = await prepareReader(zip);
    const tree = unified().use(rehypeParse, { fragment: true }).parse(doc.html) as Node;
    const text = visibleText(tree).replace(/\s+/g, " ");
    for (const [kind, pattern] of LEAKS) {
      const match = pattern.exec(text);
      if (match && !KNOWN_SOURCE_ISSUES.has(`${zip.id} ${kind}`)) {
        const at = Math.max(0, match.index - 30);
        failures.push(`${zip.id} [${doc.mode}] ${kind}: …${text.slice(at, match.index + 50)}…`);
      }
    }
  }
  assert.equal(failures.length, 0, `${failures.length} leaks:\n${failures.join("\n")}`);
});
