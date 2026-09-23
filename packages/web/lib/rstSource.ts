/** Turn ZIP RST source into markdown-ish text so the reader can show a document, not a dump. */

function isUnderline(line: string): boolean {
  const t = line.trim();
  return t.length >= 2 && /^[=~\-`#"'^]+$/.test(t);
}

function referenceHref(target: string): string | null {
  const href = target.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  return `https://zips.z.cash/${href.replace(/^\/+/, "")}`;
}

function referenceMarkdown(content: string): string | null {
  const source = content.trim();
  const wrapped = /^`(.+)`_$/.exec(source);
  const match = /^(.+?)\s*<([^>]+)>_?\s*$/.exec(wrapped?.[1] ?? source);
  if (!match) return null;

  const href = referenceHref(match[2]);
  if (href === null) return null;
  const label = match[1].replace(/([\\[\]])/g, "\\$1").replace(/\s+/g, " ");
  return `- [${label}](${href})`;
}

export function rstSourceToMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  if (lines[0]?.trim() === "::") {
    i = 1;
    while (i < lines.length && (lines[i] === "" || /^\s/.test(lines[i]))) i += 1;
  }

  const out: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    const afterNext = lines[i + 2];
    const reference = /^\.\. \[[^\]]+\]\s*(.*)$/.exec(line);
    if (reference) {
      const content = [reference[1]];
      let end = i + 1;
      while (end < lines.length && /^\s+\S/.test(lines[end])) {
        content.push(lines[end].trim());
        end += 1;
      }
      const markdown = referenceMarkdown(content.join(" "));
      if (markdown !== null) {
        out.push(markdown);
        i = end;
        continue;
      }
    }
    if (
      next !== undefined &&
      afterNext !== undefined &&
      isUnderline(line) &&
      next.trim() !== "" &&
      isUnderline(afterNext) &&
      line.trim()[0] === afterNext.trim()[0]
    ) {
      const level = line.trim().startsWith("=") ? 2 : 3;
      out.push(`${"#".repeat(level)} ${next.trim()}`);
      i += 3;
      continue;
    }
    if (next !== undefined && isUnderline(next) && line.trim() !== "") {
      const level = next.trim().startsWith("=") ? 2 : 3;
      out.push(`${"#".repeat(level)} ${line.trim()}`);
      i += 2;
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n").trim();
}
