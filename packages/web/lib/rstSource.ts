/**
 * Turn ZIP RST source into markdown so the reader can show a document, not a dump.
 * This is the fallback used when pandoc was unavailable at index time. It covers the RST
 * the zcash/zips corpus actually uses; lib/corpusRender.test.ts checks every ZIP.
 */

const ADMONITIONS = new Set([
  "admonition",
  "attention",
  "caution",
  "danger",
  "error",
  "hint",
  "important",
  "note",
  "tip",
  "warning",
]);

const CODE_DIRECTIVES = new Set(["code", "code-block", "sourcecode"]);

function isUnderline(line: string): boolean {
  const t = line.trim();
  return t.length >= 2 && /^[=~\-`#"'^]+$/.test(t);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function dedent(lines: string[]): string[] {
  const widths = lines.filter((line) => line.trim() !== "").map(indentOf);
  const cut = widths.length > 0 ? Math.min(...widths) : 0;
  const out = lines.map((line) => line.slice(cut));
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  while (out.length > 0 && out[0].trim() === "") out.shift();
  return out;
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

/** Inline RST markup to markdown. Math spans are left for remark-math. */
function inline(line: string): string {
  return line
    .replace(/``([^`]+?)``/g, (_, code: string) => `\`${code}\``)
    .replace(/:math:`([^`]+)`/g, (_, tex: string) => `$${tex}$`)
    .replace(/:sup:`([^`]+)`/g, "<sup>$1</sup>")
    .replace(/:sub:`([^`]+)`/g, "<sub>$1</sub>")
    .replace(/:[a-z][\w-]*:`([^`]+)`/g, "$1")
    .replace(/`([^`<]+?)\s*<([^>]+)>`__?/g, (_, label: string, href: string) => `[${label.trim()}](${href})`)
    .replace(/`([^`]+)`__?/g, "$1")
    .replace(/\[#?([\w.-]+)\]_/g, "[$1]")
    .replace(/\|br\|/g, "<br>");
}

type Block = { lines: string[]; end: number };

/** Lines after `start` that are blank or indented deeper than `indent`. */
function indentedBlock(lines: string[], start: number, indent: number): Block {
  let end = start;
  while (end < lines.length && (lines[end].trim() === "" || indentOf(lines[end]) > indent)) end += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return { lines: lines.slice(start, end), end };
}

function splitOptions(body: string[]): { options: Map<string, string>; content: string[] } {
  const options = new Map<string, string>();
  let i = 0;
  for (; i < body.length; i += 1) {
    const option = /^\s*:([\w-]+):\s*(.*)$/.exec(body[i]);
    if (!option) break;
    options.set(option[1], option[2]);
  }
  return { options, content: dedent(body.slice(i)) };
}

function csvCells(row: string): string[] {
  const cells: string[] = [];
  const pattern = /\s*("((?:[^"]|"")*)"|[^,]*)\s*(?:,|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(row)) !== null && match.index < row.length) {
    cells.push((match[2] ?? match[1]).replace(/""/g, '"').trim());
  }
  return cells;
}

function csvTable(options: Map<string, string>, content: string[]): string[] {
  const rows = content.filter((line) => line.trim() !== "").map(csvCells);
  const header = options.has("header") ? csvCells(options.get("header") ?? "") : rows.shift() ?? [];
  const cell = (value: string) => inline(value).replace(/\|/g, "\\|");
  return [
    `| ${header.map(cell).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ];
}

function directive(name: string, arg: string, body: string[], pad: string): string[] {
  const { options, content } = splitOptions(body);
  const indentAll = (lines: string[]) => lines.map((line) => (line === "" ? "" : pad + line));
  if (name === "math") return indentAll(["$$", ...content, "$$"]);
  if (CODE_DIRECTIVES.has(name)) return indentAll([`\`\`\`${arg.trim()}`, ...content, "```"]);
  if (name === "raw") return indentAll(content);
  if (name === "figure" || name === "image") {
    const caption = content.map(inline).join(" ").trim();
    return indentAll([`![${options.get("alt") ?? ""}](${arg.trim()})`, ...(caption ? ["", `*${caption}*`] : [])]);
  }
  if (name === "csv-table") return indentAll(csvTable(options, content));
  if (ADMONITIONS.has(name)) {
    const title = name === "admonition" ? arg.trim() : name[0].toUpperCase() + name.slice(1);
    const text = name === "admonition" ? content : [arg, ...content].filter((line, i) => i > 0 || line.trim() !== "");
    return indentAll([`> **${title}**`, "> ", ...text.map((line) => `> ${inline(line)}`.trimEnd() || ">")]);
  }
  if (name === "highlight" || name === "role" || name === "contents" || name === "sectnum") return [];
  return indentAll(content.map(inline));
}

/** An inline literal may wrap across lines: join a line holding an odd count of `` with the next. */
function joinWrappedLiterals(input: string[]): string[] {
  const delimiters = (line: string) => (line.match(/(?<!`)``(?!`)/g) ?? []).length;
  const out: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let line = input[i];
    while (delimiters(line) % 2 === 1 && i + 1 < input.length && input[i + 1].trim() !== "") {
      i += 1;
      line = `${line} ${input[i].trim()}`;
    }
    out.push(line);
  }
  return out;
}

export function rstSourceToMarkdown(source: string): string {
  const lines = joinWrappedLiterals(source.replace(/\r\n/g, "\n").split("\n"));
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
    const indent = indentOf(line);
    const pad = line.slice(0, indent);

    const reference = /^\.\. \[([^\]]+)\]\s*(.*)$/.exec(line);
    if (reference) {
      const content = [reference[2]];
      let end = i + 1;
      while (end < lines.length && /^\s+\S/.test(lines[end])) {
        content.push(lines[end].trim());
        end += 1;
      }
      const markdown = referenceMarkdown(content.join(" "));
      out.push(markdown ?? `- **[${reference[1].replace(/^#/, "")}]** ${inline(content.join(" "))}`);
      i = end;
      continue;
    }

    const substitution = /^\s*\.\. \|[^|]+\|\s+[\w-]+::/.exec(line);
    const found = /^\s*\.\. ([a-z][\w-]*)::\s*(.*)$/.exec(line);
    if (substitution || found) {
      const block = indentedBlock(lines, i + 1, indent);
      if (found && !substitution) {
        const [, name, arg] = found;
        const sameLineArg = name === "highlight" ? "" : arg;
        out.push(...directive(name, sameLineArg, block.lines, pad));
      }
      i = block.end;
      continue;
    }

    if (/^\s*\.\.(?:\s|$)/.test(line)) {
      i = indentedBlock(lines, i + 1, indent).end;
      continue;
    }

    if (/^\s*\+[-=+]+\+\s*$/.test(line)) {
      let end = i;
      while (end < lines.length && /^\s*[+|]/.test(lines[end])) end += 1;
      out.push(pad + "```", ...dedent(lines.slice(i, end)), pad + "```");
      i = end;
      continue;
    }

    if (/^\s*=+(?: +=+)+\s*$/.test(line)) {
      let borders = 0;
      let end = i;
      while (end < lines.length && lines[end].trim() !== "") {
        if (/^\s*=+(?: +=+)+\s*$/.test(lines[end])) borders += 1;
        end += 1;
        if (borders === 3) break;
      }
      out.push(pad + "```", ...dedent(lines.slice(i, end)), pad + "```");
      i = end;
      continue;
    }

    if (/::\s*$/.test(line) && lines[i + 1]?.trim() === "") {
      let start = i + 1;
      while (start < lines.length && lines[start].trim() === "") start += 1;
      if (start < lines.length && indentOf(lines[start]) > indent) {
        const block = indentedBlock(lines, start, indent);
        // RST: "text::" keeps one colon, "text ::" and a bare "::" keep none.
        const lead = /\s::\s*$/.test(line) || line.trim() === "::"
          ? line.replace(/\s*::\s*$/, "")
          : line.replace(/::\s*$/, ":");
        if (lead.trim() !== "") out.push(inline(lead), "");
        out.push(pad + "```", ...dedent(block.lines), pad + "```");
        i = block.end;
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
      out.push(`${"#".repeat(level)} ${inline(next.trim())}`);
      i += 3;
      continue;
    }
    if (next !== undefined && isUnderline(next) && line.trim() !== "") {
      const level = next.trim().startsWith("=") ? 2 : 3;
      out.push(`${"#".repeat(level)} ${inline(line.trim())}`);
      i += 2;
      continue;
    }
    out.push(inline(line));
    i += 1;
  }
  return out.join("\n").trim();
}
