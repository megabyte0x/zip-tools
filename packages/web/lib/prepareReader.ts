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
  strip: [...(defaultSchema.strip ?? []), "style"],
  tagNames: [...(defaultSchema.tagNames ?? []), "nav", ...MATHML_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), ["role", "navigation"]],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-[\w-]+$/],
      ["className", /^math-(?:inline|display)$/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^(?:katex|katex-display|katex-html|katex-mathml|base|strut|mord|mop|mbin|mrel|mopen|mclose|mpunct|minner|msupsub|vlist-t|vlist-r|vlist|pstrut|sizing|reset-size\d+|size\d+|mathnormal|mathrm|mathbf|amsrm|zip-def-term|zip-def-end)$/],
      "ariaHidden",
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      // pandoc's RST admonitions: <div class="note"><div class="title"><p>Note</p></div>…
      ["className", /^(?:katex-display|note|warning|title)$/],
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

/** Same schema as prepareReader, for the synchronous HTML branch that has no prepared document. */
export function sanitizeReaderHtml(html: string): string {
  return String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, sanitizeSchema as never)
      .use(rehypeStringify)
      .processSync(html),
  );
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

function textNode(value: string): HastNode {
  return { type: "text", value };
}

function linkNode(href: string, label: string): HastNode {
  return { type: "element", tagName: "a", properties: { href }, children: [textNode(label)] };
}

/**
 * Markdown and converted RST ZIPs open with an RFC 822 header code block.
 * Metadata belongs in ZipMeta, not a second copy in the proposal body.
 */
function removeRawHeader(tree: HastNode): void {
  const children = tree.children ?? [];
  const index = children.findIndex(
    (child) => child.type === "element" || (child.type === "text" && (child.value ?? "").trim() !== ""),
  );
  const first = children[index];
  if (!first || first.tagName !== "pre") return;
  const text = textContent(first);
  if (!/^\s*ZIP:\s*\S/m.test(text) || !/^\s*Title:/m.test(text)) return;
  children.splice(index, 1);
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

function classNames(node: HastNode): string[] {
  const className = node.properties?.className;
  return Array.isArray(className) ? className.map(String) : [];
}

function hasMarker(node: HastNode, name: string): boolean {
  if (node.tagName === "span" && classNames(node).includes(name)) return true;
  return (node.children ?? []).some((child) => hasMarker(child, name));
}

/** RST definition lists are marked in markdown, then folded into a real <dl>. */
function foldDefinitionLists(node: HastNode): void {
  if (!node.children) return;
  for (const child of node.children) foldDefinitionLists(child);
  const next: HastNode[] = [];
  let i = 0;
  while (i < node.children.length) {
    if (node.children[i].tagName !== "p" || !hasMarker(node.children[i], "zip-def-term")) {
      next.push(node.children[i]);
      i += 1;
      continue;
    }
    const items: HastNode[] = [];
    while (i < node.children.length && node.children[i].tagName === "p" && hasMarker(node.children[i], "zip-def-term")) {
      const term = textContent(node.children[i]).trim();
      i += 1;
      const body: HastNode[] = [];
      while (
        i < node.children.length &&
        !hasMarker(node.children[i], "zip-def-end") &&
        !(node.children[i].tagName === "p" && hasMarker(node.children[i], "zip-def-term"))
      ) {
        body.push(node.children[i]);
        i += 1;
      }
      if (
        i < node.children.length &&
        hasMarker(node.children[i], "zip-def-end") &&
        !(node.children[i].tagName === "p" && hasMarker(node.children[i], "zip-def-term"))
      ) i += 1;
      items.push(
        { type: "element", tagName: "dt", properties: {}, children: [textNode(term)] },
        { type: "element", tagName: "dd", properties: {}, children: body },
      );
    }
    next.push({
      type: "element",
      tagName: "dl",
      properties: { className: ["zip-definitions"] },
      children: items,
    });
  }
  node.children = next;
}

function issueLabel(href: string): string {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/.exec(href);
  return match ? `${match[1]}/${match[2]}#${match[3]}` : href;
}

function linkedText(node: HastNode): Array<{ href: string; text: string }> {
  const found: Array<{ href: string; text: string }> = [];
  if (node.tagName === "a" && typeof node.properties?.href === "string") {
    const text = textContent(node).trim();
    if (text !== "") found.push({ href: node.properties.href, text });
  }
  for (const child of node.children ?? []) found.push(...linkedText(child));
  return found;
}

function nextContent(children: HastNode[], index: number): { node: HastNode; index: number } | null {
  for (let i = index; i < children.length; i += 1) {
    const node = children[i];
    if (node.type === "text" && (node.value ?? "").trim() === "") continue;
    return { node, index: i };
  }
  return null;
}

/**
 * GitHub issue snapshots repeat two template sections: the ZIP-process checklist,
 * and the old issue-transfer byline (avatar, "Issue by", "Originally opened as").
 * Those are process status and provenance, not proposal text.
 */
function formatIssueChrome(node: HastNode): void {
  if (!node.children) return;
  for (const child of node.children) formatIssueChrome(child);
  const next: HastNode[] = [];
  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i];
    const text = textContent(child).replace(/\s+/g, " ").trim();
    if (child.tagName === "blockquote" && text.startsWith("Next steps in the ZIP process")) {
      const list = (child.children ?? []).find((item) => item.tagName === "ul");
      next.push({
        type: "element",
        tagName: "aside",
        properties: { className: ["zip-process"] },
        children: [
          { type: "element", tagName: "p", properties: {}, children: [textNode("ZIP process")] },
          list ?? { type: "element", tagName: "p", properties: {}, children: [textNode(text.replace(/^Next steps in the ZIP process:?\s*/, ""))] },
        ],
      });
      const following = nextContent(node.children, i + 1);
      if (following?.node.tagName === "hr") i = following.index;
      continue;
    }
    if (child.tagName === "p" && text.includes("Issue by") && text.includes("Originally opened as")) {
      const links = linkedText(child);
      const author = links.find((link) => link.href.startsWith("https://github.com/") && !/\/issues\/\d+/.test(link.href));
      const original = links.find((link) => /\/issues\/\d+/.test(link.href));
      const date = (child.children ?? [])
        .filter((item) => item.tagName === "em" && !textContent(item).includes("Originally opened as"))
        .map((item) => textContent(item).trim())
        .find(Boolean);
      const origin: HastNode[] = [];
      if (author) {
        origin.push({
          type: "element",
          tagName: "p",
          properties: {},
          children: [textNode("Transferred issue by "), linkNode(author.href, author.text)],
        });
      }
      if (date) origin.push({ type: "element", tagName: "p", properties: {}, children: [textNode(date)] });
      if (original) {
        origin.push({
          type: "element",
          tagName: "p",
          properties: {},
          children: [textNode("Originally "), linkNode(original.href, issueLabel(original.href))],
        });
      }
      if (origin.length > 0) {
        next.push({
          type: "element",
          tagName: "aside",
          properties: { className: ["zip-issue-origin"] },
          children: origin,
        });
        const following = nextContent(node.children, i + 1);
        if (following?.node.tagName === "hr") i = following.index;
        continue;
      }
    }
    next.push(child);
  }
  node.children = next;
}

function prepareTree(tree: HastNode, zip: ZipRecord): ReaderHeading[] {
  removeRawHeader(tree);
  foldDefinitionLists(tree);
  formatIssueChrome(tree);
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
