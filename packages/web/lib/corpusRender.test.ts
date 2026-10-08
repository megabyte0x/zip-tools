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

function classesOf(node: Node): string[] {
  const className = node.properties?.className;
  return Array.isArray(className) ? className.map(String) : [];
}

/** Visible prose: skips rendered KaTeX, code and preformatted blocks, which are checked separately. */
function visibleText(node: Node): string {
  if (node.type === "text") return node.value ?? "";
  if (classesOf(node).some((name) => name.startsWith("katex"))) return "";
  if (node.tagName === "code" || node.tagName === "pre") return "";
  return (node.children ?? []).map(visibleText).join(" ");
}

/** Text inside code and pre blocks, where raw TeX means math was mistaken for code. */
function codeText(node: Node, inCode = false): string {
  if (node.type === "text") return inCode ? node.value ?? "" : "";
  if (classesOf(node).some((name) => name.startsWith("katex"))) return "";
  const code = inCode || node.tagName === "code" || node.tagName === "pre";
  return (node.children ?? []).map((child) => codeText(child, code)).join(" ");
}

function countKatexErrors(node: Node): number {
  const own = classesOf(node).includes("katex-error") ? 1 : 0;
  return own + (node.children ?? []).reduce((sum, child) => sum + countKatexErrors(child), 0);
}

const LEAKS: Array<[string, RegExp]> = [
  ["tex command", /\\?\b(?:mathsf|mathrm|mathbb|mathcal|textsf|begin\{|frac\{|cdot\b)/g],
  ["tex delimiter", /\$[^$\s][^$]*\$|\\\(|\\\[/g],
  ["rst role", /:(?:math|sup|sub|ref|doc):`/g],
  ["rst directive", /(?:^|\s)\.\. [a-z-]+::/g],
  ["rst link", /`[^`]+ <[^>]+>`_/g],
  ["rst literal", /``[^`]+``/g],
  ["rst citation", /\[#?[\w-]+\]_|\[#[\w.-]+\]/g],
  ["rst substitution", /\|br\|/g],
];

const TEX_IN_CODE = /\$\\[a-zA-Z]+|\\math(?:sf|rm|bb|cal|tt)\{/g;

/**
 * Known cases, each keyed by "<zip id> <render mode> <kind>" with its exact count, so one more
 * occurrence still fails and a fixed upstream typo (count drops) asks for this list to shrink.
 * "full" is the pandoc path (or markdown), "degraded" is the no-pandoc RST fallback.
 */
const TYPO = "upstream source typo, rendered the same on zips.z.cash";
const SPANNING_TABLE = "grid table with spanning cells stays preformatted on the fallback path";
const KNOWN_SOURCE_ISSUES = new Map<string, [number, string]>([
  ["155 full tex delimiter", [2, "literal ${PLACEHOLDER} text, zip-0155.rst:174"]],
  ["155 degraded tex delimiter", [2, "literal ${PLACEHOLDER} text, zip-0155.rst:174"]],
  ["208 full tex command", [1, `unclosed $, zip-0208.rst:98; ${TYPO}`]],
  ["208 degraded tex command", [1, `unclosed $, zip-0208.rst:98; ${TYPO}`]],
  ["208 full rst citation", [1, `citation missing its _, zip-0208.rst:68; ${TYPO}`]],
  ["208 degraded rst citation", [1, `citation missing its _, zip-0208.rst:68; ${TYPO}`]],
  ["208 full katex error", [1, `unbalanced brace, zip-0208.rst:184; ${TYPO}`]],
  ["208 degraded katex error", [1, `unbalanced brace, zip-0208.rst:184; ${TYPO}`]],
  ["2008 full rst citation", [3, "RST source intentionally quoted as proposed edits to ZIPs 207 and 214"]],
  ["218 full rst citation", [1, `RST citation in a markdown ZIP, zip-0218.md:85; ${TYPO}`]],
  ["228 full tex command", [1, `malformed ($i = 0$; ...; $i++$) math, zip-0228.rst:134; ${TYPO}`]],
  ["228 full rst role", [1, `same malformed math, zip-0228.rst:134; ${TYPO}`]],
  ["230 full rst citation", [1, `citation missing its _, zip-0230.rst:329; ${TYPO}`]],
  ["230 degraded rst citation", [1, `citation missing its _, zip-0230.rst:329; ${TYPO}`]],
  ["230 full katex error", [1, `unbalanced brace, zip-0230.rst:511; ${TYPO}`]],
  ["230 degraded katex error", [1, `unbalanced brace, zip-0230.rst:511; ${TYPO}`]],
  ["231 full tex delimiter", [1, `escaped \\$mathtt, zip-0231.md:399; ${TYPO}`]],
  ["1012 full tex delimiter", [1, "dollar amounts ($700k/month), not math"]],
  ["1012 degraded tex delimiter", [1, "dollar amounts ($700k/month), not math"]],
  [
    "draft-mcgee-keyholders-organizations full tex delimiter",
    [1, "two literal $25 million currency amounts are mistaken for a math delimiter"],
  ],
  ["draft-ecc-authenticated-reply-addrs full rst citation", [3, `[#BCP14] with a nonstandard definition, line 17; ${TYPO}`]],
  ["draft-str4d-orchard-balance-proof full rst citation", [3, `RST citations in a markdown ZIP; ${TYPO}`]],
  ["225 degraded tex in code", [1, SPANNING_TABLE]],
  ["225 degraded formulas missing", [2, SPANNING_TABLE]],
  ["230 degraded tex in code", [2, SPANNING_TABLE]],
  ["230 degraded formulas missing", [1, SPANNING_TABLE]],
  ["246 degraded formulas missing", [1, SPANNING_TABLE]],
]);

function leaks(id: string, mode: string, html: string): string[] {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html) as Node;
  const text = visibleText(tree).replace(/\s+/g, " ");
  const counts = new Map<string, { count: number; sample: string }>();
  const record = (kind: string, source: string, pattern: RegExp) => {
    const matches = [...source.matchAll(pattern)];
    if (matches.length === 0) return;
    const at = Math.max(0, (matches[0].index ?? 0) - 30);
    counts.set(kind, { count: matches.length, sample: source.slice(at, (matches[0].index ?? 0) + 50) });
  };
  for (const [kind, pattern] of LEAKS) record(kind, text, pattern);
  record("tex in code", codeText(tree).replace(/\s+/g, " "), TEX_IN_CODE);
  const errors = countKatexErrors(tree);
  if (errors > 0) counts.set("katex error", { count: errors, sample: "" });

  const found: string[] = [];
  const prefix = `${id} ${mode} `;
  const kinds = new Set([
    ...counts.keys(),
    ...[...KNOWN_SOURCE_ISSUES.keys()]
      .filter((key) => key.startsWith(prefix) && !key.endsWith(" formulas missing"))
      .map((key) => key.slice(prefix.length)),
  ]);
  for (const kind of kinds) {
    const actual = counts.get(kind)?.count ?? 0;
    const expected = KNOWN_SOURCE_ISSUES.get(`${prefix}${kind}`)?.[0] ?? 0;
    if (actual !== expected) {
      found.push(`${id} [${mode}] ${kind}: ${actual} (known ${expected}) …${counts.get(kind)?.sample ?? ""}…`);
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
    // Nothing may be dropped: the fallback renders at least as many formulas as pandoc.
    const full = await prepareReader(zip);
    const formulas = (html: string) => (html.match(/class="katex"/g) ?? []).length;
    if (full.mode === "full") {
      const missing = Math.max(0, formulas(full.html) - formulas(doc.html));
      const known = KNOWN_SOURCE_ISSUES.get(`${zip.id} degraded formulas missing`)?.[0] ?? 0;
      if (missing !== known) {
        failures.push(`${zip.id} [degraded] formulas missing: ${missing} (known ${known}; pandoc renders ${formulas(full.html)})`);
      }
    }
  }
  assert.equal(failures.length, 0, `${failures.length} leaks:\n${failures.join("\n")}`);
});
