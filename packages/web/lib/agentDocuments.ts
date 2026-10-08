import type { PreparedReader } from "./workbenchContracts";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";

type Node = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };
const parser = unified().use(rehypeParse, { fragment: true });
const serializer = unified().use(rehypeStringify);
const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join("");
const walk = (node: Node): Node[] => [node, ...(node.children ?? []).flatMap(walk)];
export const partHref = (href: string, part: number): string => part === 1 ? href : `${href}?part=${part}`;

function markdown(node: Node): string {
  const anchor = typeof node.properties?.id === "string" ? `<a id="${node.properties.id.replace(/["<>]/g, "")}"></a>\n` : "";
  return anchor + render(node);
}

function render(node: Node): string {
  if (node.type === "text") return node.value ?? "";
  const tag = node.tagName ?? "";
  const children = () => (node.children ?? []).map(markdown).join("");
  const classes = node.properties?.className as string[] | undefined;
  if (classes?.includes("katex")) {
    const annotation = walk(node).find((child) => child.tagName === "annotation");
    return annotation ? `$${text(annotation)}$` : text(node);
  }
  if (["script", "style", "svg"].includes(tag)) return "";
  if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${children().trim()}\n\n`;
  if (tag === "a") return `[${children()}](${String(node.properties?.href ?? "")})`;
  if (tag === "img") return `![${String(node.properties?.alt ?? "")}](${String(node.properties?.src ?? "")})`;
  if (tag === "pre") {
    const fence = "`".repeat(Math.max(3, ...Array.from(text(node).matchAll(/`+/g), (match) => match[0].length + 1)));
    return `\n\n${fence}\n${text(node).trimEnd()}\n${fence}\n\n`;
  }
  if (tag === "code") return `\`${text(node)}\``;
  if (tag === "strong" || tag === "b") return `**${children()}**`;
  if (tag === "em" || tag === "i") return `*${children()}*`;
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n\n---\n\n";
  if (tag === "li") return `- ${children().trim().replace(/\n/g, "\n  ")}\n`;
  if (tag === "ul" || tag === "ol") {
    let number = Number(node.properties?.start ?? 1);
    return `\n\n${(node.children ?? []).map((child) => {
      if (child.tagName !== "li") return markdown(child);
      if (typeof child.properties?.value === "number") number = child.properties.value;
      const marker = tag === "ol" ? `${number++}. ` : "- ";
      const body = (child.children ?? []).map(markdown).join("").trim();
      return marker + body.replace(/\n/g, "\n" + " ".repeat(marker.length)) + "\n";
    }).join("")}\n`;
  }
  if (tag === "blockquote") return `\n\n${children().trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  if (tag === "table") {
    const rows = walk(node).filter((child) => child.tagName === "tr").map((row) =>
      (row.children ?? []).filter((cell) => cell.tagName === "td" || cell.tagName === "th")
        .map((cell) => markdown(cell).trim().replace(/\n/g, " ").replace(/\|/g, "\\|")));
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const row = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
    return `\n\n${row(rows[0])}\n${row(Array(width).fill("---"))}\n${rows.slice(1).map(row).join("\n")}\n\n`;
  }
  if (["p", "div", "section", "aside", "dl"].includes(tag)) return `\n\n${children().trim()}\n\n`;
  if (tag === "dt") return `\n**${children()}**: `;
  if (tag === "dd") return `${children()}\n`;
  return children();
}

export function htmlToMarkdown(html: string): string {
  return markdown(parser.parse(html) as Node).replace(/\n{3,}/g, "\n\n").trim();
}

export function paginateReader(document: PreparedReader, href: string, limit = 40000): PreparedReader[] {
  const tree = parser.parse(document.html) as Node;
  if (text(tree).length <= limit) return [document];
  const groups: Node[][] = [[]];
  let size = 0;
  let pending: Node[] = [];
  for (const child of tree.children ?? []) {
    if (/^h[1-6]$/.test(child.tagName ?? "") || (child.type === "text" && !text(child).trim())) {
      pending.push(child);
      continue;
    }
    const block = [...pending, child];
    const length = block.reduce((sum, node) => sum + text(node).length, 0);
    if (size && size + length > limit) { groups.push([]); size = 0; }
    groups[groups.length - 1].push(...block);
    size += length;
    pending = [];
  }
  groups[groups.length - 1].push(...pending);
  const owners = new Map<string, number>();
  groups.forEach((nodes, i) => nodes.flatMap(walk).forEach((node) => {
    if (typeof node.properties?.id === "string") owners.set(node.properties.id, i + 1);
  }));
  return groups.map((children, i) => {
    const root: Node = { type: "root", children };
    for (const node of walk(root)) {
      const link = node.properties?.href;
      if (typeof link === "string" && link.startsWith("#")) {
        const owner = owners.get(link.slice(1));
        if (owner && owner !== i + 1) node.properties!.href = `${partHref(href, owner)}${link}`;
      }
    }
    return { ...document, html: String(serializer.stringify(root as never)), toc: document.toc.filter((heading) => owners.get(heading.id) === i + 1) };
  });
}
