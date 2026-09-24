import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { prepareReader } from "./prepareReader.ts";
import type { ZipIndexFile } from "./types.ts";

type Node = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };

const INDEX = new URL("../data/zip-index.json", import.meta.url);
const SOURCE = new URL("../../../submodule/zips/", import.meta.url);

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
  ["rst citation", /\[#?[\w-]+\]_|\[#[\w.-]+\]/],
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
  ["208 rst citation", "citation missing its trailing _, zip-0208.rst:68"],
  ["230 rst citation", "citation missing its trailing _, zip-0230.rst:329"],
  ["draft-ecc-authenticated-reply-addrs rst citation", "[#BCP14] with a nonstandard definition, draft-ecc-authenticated-reply-addrs.md:17"],
  ["218 rst citation", "RST citation [#slowfastblocks]_ inside a markdown ZIP, zip-0218.md:85"],
  ["draft-str4d-orchard-balance-proof rst citation", "RST citation [#BCP14]_ inside a markdown ZIP"],
]);

function leaks(id: string, mode: string, html: string): string[] {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html) as Node;
  const text = visibleText(tree).replace(/\s+/g, " ");
  const found: string[] = [];
  for (const [kind, pattern] of LEAKS) {
    const match = pattern.exec(text);
    if (match && !KNOWN_SOURCE_ISSUES.has(`${id} ${kind}`)) {
      const at = Math.max(0, match.index - 30);
      found.push(`${id} [${mode}] ${kind}: …${text.slice(at, match.index + 50)}…`);
    }
  }
  return found;
}

test("every ZIP in the built index renders without leaked TeX or raw RST", { skip: !existsSync(INDEX) }, async () => {
  const index = JSON.parse(readFileSync(INDEX, "utf8")) as ZipIndexFile;
  const failures: string[] = [];
  for (const zip of index.zips) {
    const doc = await prepareReader(zip);
    failures.push(...leaks(zip.id, doc.mode, doc.html));
  }
  assert.equal(failures.length, 0, `${failures.length} leaks:\n${failures.join("\n")}`);
});

/** Production may build without pandoc, so every RST ZIP must also read well through the fallback. */
test("every RST ZIP also renders cleanly through the no-pandoc fallback", { skip: !existsSync(INDEX) || !existsSync(SOURCE) }, async () => {
  const index = JSON.parse(readFileSync(INDEX, "utf8")) as ZipIndexFile;
  const rst = index.zips.filter((zip) => zip.sourcePath.endsWith(".rst"));
  assert.ok(rst.length > 50, `expected the full corpus, found ${rst.length} RST ZIPs`);
  const failures: string[] = [];
  for (const zip of rst) {
    const source = readFileSync(new URL(zip.sourcePath, SOURCE), "utf8");
    const doc = await prepareReader({ ...zip, bodyFormat: "rst-source", body: source });
    assert.equal(doc.mode, "degraded");
    failures.push(...leaks(zip.id, doc.mode, doc.html));
  }
  assert.equal(failures.length, 0, `${failures.length} leaks:\n${failures.join("\n")}`);
});
