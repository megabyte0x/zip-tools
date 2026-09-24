import rehypeKatex from "rehype-katex";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { PreparedReader, ReaderHeading } from "./workbenchContracts";
import { escapeTextUnderscores, fenceDisplayMath } from "./mathCompat";
import { readerAssetUrl, readerProposalHref } from "./readerLinks";
import { supportedIssueUrl } from "./readerSource";
import { rstSourceToMarkdown } from "./rstSource";
import { allocateHeadingId } from "./toc";
import type { BodyFormat, ZipRecord } from "./types";

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const MATHML_TAGS = [
  "math", "semantics", "annotation", "mrow", "mi", "mo", "mn", "mtext", "mspace",
  "mfrac", "msqrt", "mroot", "mstyle", "msub", "msup", "msubsup", "munder", "mover",
  "munderover", "mtable", "mtr", "mtd", "mpadded", "mphantom", "menclose",
];

const sanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [...(defaultSchema.tagNames ?? []), ...MATHML_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-[\w-]+$/],
      ["className", /^math-(?:inline|display)$/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^(?:katex|katex-display|katex-html|katex-mathml|base|strut|mord|mop|mbin|mrel|mopen|mclose|mpunct|minner|msupsub|vlist-t|vlist-r|vlist|pstrut|sizing|reset-size\d+|size\d+|mathnormal|mathrm|mathbf|amsrm)$/],
      "ariaHidden",
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", /^(?:katex-display)$/],
    ],
    math: ["xmlns", "display"],
    annotation: ["encoding"],
    mi: ["mathVariant"],
    mo: ["stretchy", "fence", "separator", "lspace", "rspace"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
};

function legacyFormat(zip: ZipRecord): BodyFormat {
  if (zip.body === null) return "none";
  if (zip.bodyFormat !== undefined) return zip.bodyFormat;
  if (zip.bodyKind === "rst") return /^\s*</.test(zip.body) ? "html" : "rst-source";
  if (zip.bodyKind === "md") return "markdown";
  if (zip.bodyKind === "draft") {
    if (/\.rst$/i.test(zip.sourcePath)) return /^\s*</.test(zip.body) ? "html" : "rst-source";
    return "markdown";
  }
  return "none";
}

async function markdownTree(markdown: string): Promise<HastNode> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true });
  const tree = await processor.run(processor.parse(fenceDisplayMath(markdown)));
  const html = String(
    unified().use(rehypeStringify, { allowDangerousHtml: true }).stringify(tree),
  );
  const safeTree = await sanitize(await htmlTree(html));
  return await katex(safeTree);
}

/**
 * pandoc --mathjax emits <span class="math inline">\(tex\)</span> and
 * <span class="math display">\[tex\]</span>. Re-shape them into the code elements that
 * remark-math produces, so the sanitizer keeps them and rehype-katex renders them.
 */
function pandocMathToKatex(node: HastNode): void {
  for (const child of node.children ?? []) {
    pandocMathToKatex(child);
    const className = child.properties?.className;
    const classes = Array.isArray(className) ? className.map(String) : [];
    if (child.tagName !== "span" || !classes.includes("math")) continue;
    const display = classes.includes("display");
    const tex = textContent(child)
      .trim()
      .replace(display ? /^\\\[([\s\S]*)\\\]$/ : /^\\\(([\s\S]*)\\\)$/, "$1")
      .trim();
    const code: HastNode = {
      type: "element",
      tagName: "code",
      properties: { className: ["language-math"] },
      children: [{ type: "text", value: tex }],
    };
    // rehype-katex renders a <pre><code class="language-math"> as display math.
    child.tagName = display ? "pre" : "code";
    child.properties = display ? {} : code.properties;
    child.children = display ? [code] : code.children;
  }
}

async function katex(tree: HastNode): Promise<HastNode> {
  for (const node of elements(tree)) {
    const className = node.properties?.className;
    if (!Array.isArray(className) || !className.includes("language-math")) continue;
    for (const child of node.children ?? []) {
      if (child.type === "text") child.value = escapeTextUnderscores(child.value ?? "");
    }
  }
  return await unified().use(rehypeKatex).run(tree as never) as HastNode;
}

async function htmlMathTree(html: string): Promise<HastNode> {
  const tree = await htmlTree(html);
  pandocMathToKatex(tree);
  return await katex(await sanitize(tree));
}

async function htmlTree(html: string): Promise<HastNode> {
  const processor = unified().use(rehypeParse, { fragment: true });
  return await processor.run(processor.parse(html)) as HastNode;
}

async function sanitize(tree: HastNode): Promise<HastNode> {
  return await unified().use(rehypeSanitize, sanitizeSchema as never).run(tree as never) as HastNode;
}

function textContent(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.tagName === "img") {
    const alt = node.properties?.alt;
    return typeof alt === "string" ? alt : "";
  }
  return (node.children ?? []).map(textContent).join("");
}

function elements(tree: HastNode): HastNode[] {
  const found: HastNode[] = [];
  const visit = (node: HastNode): void => {
    if (node.type === "element") found.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return found;
}

function issueRelativeHref(zip: ZipRecord, href: string): string {
  if (zip.bodySource?.kind !== "github-issue") return href;

  const value = href.trim();
  if (
    value === "" ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return href;
  }

  const issueUrl = supportedIssueUrl(zip.bodySource.url);
  if (issueUrl === null) return "#";
  try {
    return new URL(value, issueUrl).href;
  } catch {
    return "#";
  }
}

function wrapTables(node: HastNode): void {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    wrapTables(child);
    if (child.tagName !== "table") return child;
    return {
      type: "element",
      tagName: "div",
      properties: { className: ["reader-table-scroll"] },
      children: [child],
    };
  });
}

/**
 * Markdown ZIPs open with their RFC-style header ("ZIP: 229", "Title: ...") as a code
 * block. The sidebar already shows those fields, so keep the original but fold it away.
 */
function collapseRawHeader(tree: HastNode): void {
  const children = tree.children ?? [];
  const index = children.findIndex(
    (child) => child.type === "element" || (child.type === "text" && (child.value ?? "").trim() !== ""),
  );
  const first = children[index];
  if (!first || first.tagName !== "pre") return;
  const text = textContent(first);
  if (!/^\s*ZIP:\s*\S/.test(text) || !/^\s*Title:/m.test(text)) return;
  children[index] = {
    type: "element",
    tagName: "details",
    properties: { className: ["zip-raw-header"] },
    children: [
      { type: "element", tagName: "summary", properties: {}, children: [{ type: "text", value: "Original header" }] },
      first,
    ],
  };
}

const HEADING = /^h([1-6])$/;

/**
 * The page title is the only h1. Bodies that open sections with h1 (markdown "# Rationale",
 * pandoc's top-level RST sections) shift every heading down one level instead.
 */
function demoteHeadings(all: HastNode[]): void {
  if (!all.some((node) => node.tagName === "h1")) return;
  for (const node of all) {
    const level = HEADING.exec(node.tagName ?? "");
    if (level) node.tagName = `h${Math.min(Number(level[1]) + 1, 6)}`;
  }
}

function prepareTree(tree: HastNode, zip: ZipRecord): ReaderHeading[] {
  collapseRawHeader(tree);
  demoteHeadings(elements(tree));
  wrapTables(tree);
  const all = elements(tree);
  for (const node of all) {
    if (node.tagName === "a" && typeof node.properties?.href === "string") {
      node.properties.href = readerProposalHref(issueRelativeHref(zip, node.properties.href));
    }
    if (node.tagName === "img" && typeof node.properties?.src === "string") {
      const src = readerAssetUrl(zip, node.properties.src);
      if (src) node.properties.src = src;
      else delete node.properties.src;
    }
  }

  const headings = all.filter((node) => node.tagName === "h2" || node.tagName === "h3");
  const used = new Set<string>();
  const keepExisting = new Set<HastNode>();
  for (const node of all) {
    const id = node.properties?.id;
    if (typeof id !== "string" || id === "") continue;
    if (!used.has(id)) {
      used.add(id);
      keepExisting.add(node);
    } else if (node.tagName !== "h2" && node.tagName !== "h3") {
      delete node.properties?.id;
    }
  }

  return headings.map((heading) => {
    const text = textContent(heading).trim();
    const id = keepExisting.has(heading)
      ? String(heading.properties?.id)
      : allocateHeadingId(text, used);
    heading.properties ??= {};
    heading.properties.id = id;
    return { id, text, level: heading.tagName === "h2" ? 2 : 3 };
  });
}

export async function prepareReader(zip: ZipRecord): Promise<PreparedReader> {
  const format = legacyFormat(zip);
  if (zip.body === null || format === "none") {
    return { html: "", toc: [], mode: "missing", warnings: [] };
  }

  const degraded = format === "rst-source";
  const source = degraded ? rstSourceToMarkdown(zip.body) : zip.body;
  const tree = format === "html"
    ? await htmlMathTree(source)
    : await markdownTree(source);
  const toc = prepareTree(tree, zip);
  const html = String(unified().use(rehypeStringify).stringify(tree as never));
  const warnings = [...zip.parseWarnings];
  if (degraded) warnings.push("Full-fidelity RST conversion was unavailable.");

  return { html, toc, mode: degraded ? "degraded" : "full", warnings };
}
