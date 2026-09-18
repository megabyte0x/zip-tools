export type TocEntry = { id: string; text: string; level: 2 | 3 };

export function activeTocId(
  headings: { id: string; top: number }[],
  offset: number,
): string | null {
  if (headings.length === 0) return null;
  let current = headings[0]?.id ?? null;
  for (const heading of headings) {
    if (heading.top <= offset) current = heading.id;
  }
  return current;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function headingTextFromNode(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingTextFromNode).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { alt?: unknown; children?: unknown } }).props;
    const alt = typeof props?.alt === "string" ? props.alt : "";
    return `${alt}${headingTextFromNode(props?.children)}`;
  }
  return "";
}

export function allocateHeadingId(text: string, used: Set<string>): string {
  const base = slugifyHeading(text);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  const id = `${base}-${n}`;
  used.add(id);
  return id;
}

function headingTextFromHtml(inner: string): string {
  return inner.replace(/<[^>]+>/g, "").trim();
}

function headingTextFromMarkdown(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function existingHeadingId(attrs: string): string | undefined {
  const match = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3];
}

const HEADING_RE = /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

export function tocFromHtml(html: string): { html: string; toc: TocEntry[] } {
  const parsed: {
    tag: string;
    attrs: string;
    inner: string;
    text: string;
    existing: string | undefined;
    keepExisting: boolean;
  }[] = [];
  for (const match of html.matchAll(new RegExp(HEADING_RE, "gi"))) {
    const tag = match[1] ?? "h2";
    const attrs = match[2] ?? "";
    const inner = match[3] ?? "";
    parsed.push({
      tag,
      attrs,
      inner,
      text: headingTextFromHtml(inner),
      existing: existingHeadingId(attrs),
      keepExisting: false,
    });
  }

  const reserved = new Set<string>();
  for (const heading of parsed) {
    if (heading.existing && !reserved.has(heading.existing)) {
      reserved.add(heading.existing);
      heading.keepExisting = true;
    }
  }

  const used = new Set(reserved);
  const toc: TocEntry[] = [];
  const ids: string[] = [];
  for (const heading of parsed) {
    const id =
      heading.keepExisting && heading.existing
        ? heading.existing
        : allocateHeadingId(heading.text, used);
    ids.push(id);
    toc.push({
      id,
      text: heading.text,
      level: Number(heading.tag.slice(1)) as 2 | 3,
    });
  }

  let i = 0;
  const rewritten = html.replace(new RegExp(HEADING_RE, "gi"), (_full, tag: string, rawAttrs: string | undefined, inner: string) => {
    const heading = parsed[i];
    const id = ids[i] ?? "";
    i += 1;
    const attrs = rawAttrs ?? "";
    if (heading?.keepExisting) return `<${tag}${attrs}>${inner}</${tag}>`;
    if (heading?.existing) {
      const nextAttrs = attrs.replace(
        /\bid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,
        `id="${id}"`,
      );
      return `<${tag}${nextAttrs}>${inner}</${tag}>`;
    }
    return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
  });
  return { html: rewritten, toc };
}

export function tocFromMarkdown(md: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  for (const line of md.split(/\r?\n/)) {
    const match = /^(#{2,3})[ \t]+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const hashes = match[1];
    const raw = (match[2] ?? "").replace(/[ \t]+#+\s*$/, "").trim();
    const text = headingTextFromMarkdown(raw);
    const level = hashes.length as 2 | 3;
    toc.push({ id: allocateHeadingId(text, used), text, level });
  }
  return toc;
}
