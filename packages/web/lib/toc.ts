export type TocEntry = { id: string; text: string; level: 2 | 3 };

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function allocateHeadingId(text: string, seen: Map<string, number>): string {
  const base = slugifyHeading(text);
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

function headingTextFromHtml(inner: string): string {
  return inner.replace(/<[^>]+>/g, "").trim();
}

function existingHeadingId(attrs: string): string | undefined {
  const match = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3];
}

export function tocFromHtml(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  const rewritten = html.replace(
    /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, rawAttrs: string | undefined, inner: string) => {
      const attrs = rawAttrs ?? "";
      const level = Number(tag.slice(1)) as 2 | 3;
      const text = headingTextFromHtml(inner);
      const existing = existingHeadingId(attrs);
      const id = existing ?? allocateHeadingId(text, seen);
      if (existing) {
        const n = seen.get(existing) ?? 0;
        seen.set(existing, Math.max(n, 1));
      }
      toc.push({ id, text, level });
      if (existing) return `<${tag}${attrs}>${inner}</${tag}>`;
      return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
    },
  );
  return { html: rewritten, toc };
}

export function tocFromMarkdown(md: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  for (const line of md.split(/\r?\n/)) {
    const match = /^(#{2,3})[ \t]+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const hashes = match[1];
    const raw = match[2].replace(/[ \t]+#+\s*$/, "").trim();
    const level = hashes.length as 2 | 3;
    toc.push({ id: allocateHeadingId(raw, seen), text: raw, level });
  }
  return toc;
}
