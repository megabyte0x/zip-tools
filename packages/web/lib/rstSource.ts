/** Turn ZIP RST source into markdown-ish text so the reader can show a document, not a dump. */

function isUnderline(line: string): boolean {
  const t = line.trim();
  return t.length >= 2 && /^[=~\-`#"'^]+$/.test(t);
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
