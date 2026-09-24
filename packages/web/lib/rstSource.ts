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

/** A run of one repeated RST adornment character (any printable punctuation), except "::". */
function isUnderline(line: string): boolean {
  const t = line.trim();
  return t.length >= 2 && t !== "::" && /^([!-/:-@[-`{-~])\1+$/.test(t);
}

/** Simple table ("====  ====" borders) to a GitHub table, splitting cells at the border's column starts. */
function simpleTable(rows: string[]): string[] {
  const border = /^=+(?: +=+)+$/;
  const starts = [...rows[0].matchAll(/=+/g)].map((match) => match.index ?? 0);
  const cellsOf = (row: string) =>
    starts.map((start, n) => row.slice(start, starts[n + 1] ?? row.length).trim());
  const borders = rows.flatMap((row, n) => (border.test(row.trim()) ? [n] : []));
  const hasHeader = borders.length >= 3;
  const records: string[][] = [];
  let header: string[] | null = null;
  rows.forEach((row, n) => {
    if (border.test(row.trim()) || row.trim() === "") return;
    const cells = cellsOf(row);
    if (hasHeader && n < borders[1]) {
      header = header ? header.map((cell, c) => `${cell} ${cells[c]}`.trim()) : cells;
      return;
    }
    // A row with an empty first column continues the row above.
    if (cells[0] === "" && records.length > 0) {
      const last = records[records.length - 1];
      cells.forEach((cell, c) => (last[c] = `${last[c]} ${cell}`.trim()));
      return;
    }
    records.push(cells);
  });
  const format = (cells: string[]) => `| ${cells.map(tableCell).join(" | ")} |`;
  const head: string[] = header ?? starts.map(() => "");
  return [format(head), `| ${starts.map(() => "---").join(" | ")} |`, ...records.map(format)];
}

/** One table cell: bars inside math become \\Vert / \\vert, other pipes are escaped. */
function tableCell(text: string): string {
  return inline(text)
    .split(/(\$[^$]+\$)/)
    .map((part, n) =>
      n % 2 === 1
        ? part.replace(/\\\|/g, "\\Vert ").replace(/\|/g, "\\vert ")
        : part.replace(/\|/g, "\\|"),
    )
    .join("");
}

const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)]|#\.)\s+/;

/**
 * Grid table to a GitHub table when every row uses the border's column positions.
 * Tables with spanning cells return null and stay preformatted.
 */
function gridTable(rows: string[]): string[] | null {
  const border = /^\+(?:[-=]+\+)+$/;
  if (!border.test(rows[0] ?? "")) return null;
  const cuts = [...rows[0]].flatMap((ch, at) => (ch === "+" ? [at] : []));
  const groups: string[][][] = [];
  let headerRows = 0;
  let current: string[][] = [];
  for (const row of rows.slice(1)) {
    if (border.test(row)) {
      if ([...row].flatMap((ch, at) => (ch === "+" ? [at] : [])).join() !== cuts.join()) return null;
      if (current.length > 0) groups.push(current);
      current = [];
      if (row.includes("=")) headerRows = groups.length;
      continue;
    }
    if (!row.startsWith("|") || cuts.some((at) => row[at] !== "|")) return null;
    current.push(cuts.slice(0, -1).map((at, n) => row.slice(at + 1, cuts[n + 1]).trim()));
  }
  if (current.length > 0 || groups.length === 0) return null;
  const cells = groups.map((group) =>
    group[0].map((_, column) =>
      tableCell(group.map((line) => line[column]).filter(Boolean).join(" ")),
    ),
  );
  const header = headerRows === 1 ? cells[0] : cells[0].map(() => " ");
  const body = headerRows === 1 ? cells.slice(1) : cells;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ];
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
  if (name === "math") return indentAll(["$$", ...(arg.trim() ? [arg.trim()] : []), ...content, "$$"]);
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
  const styles: string[] = [];
  const heading = (style: string, title: string) => {
    if (!styles.includes(style)) styles.push(style);
    const level = Math.min(styles.indexOf(style) + 2, 6);
    return `${"#".repeat(level)} ${inline(title.trim())}`;
  };
  let listContext = false;
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
      const rows = dedent(lines.slice(i, end)).map((row) => row.trimEnd());
      const table = gridTable(rows);
      out.push(...(table ? table.map((row) => pad + row) : [pad + "```", ...rows, pad + "```"]));
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
      out.push(...simpleTable(dedent(lines.slice(i, end)).map((row) => row.trimEnd())).map((row) => pad + row));
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
      out.push(heading(`over${line.trim()[0]}`, next));
      listContext = false;
      i += 3;
      continue;
    }
    if (next !== undefined && isUnderline(next) && line.trim() !== "") {
      out.push(heading(`under${next.trim()[0]}`, line));
      listContext = false;
      i += 2;
      continue;
    }
    // An indented block after a blank line, outside a list, is an RST block quote. Markdown
    // would read four spaces as code, so convert its contents and quote them.
    if (indent > 0 && !listContext && (i === 0 || lines[i - 1].trim() === "")) {
      const block = indentedBlock(lines, i, indent - 1);
      const inner = rstSourceToMarkdown(dedent(block.lines).join("\n"));
      out.push(...inner.split("\n").map((row) => (row.trim() === "" ? ">" : `> ${row}`)));
      i = block.end;
      continue;
    }

    if (line.trim() !== "") {
      if (LIST_ITEM.test(line)) listContext = true;
      else if (indent === 0) listContext = false;
    }
    out.push(inline(line.replace(/^(\s*)#\.(\s)/, "$11.$2")));
    i += 1;
  }
  return out.join("\n").trim();
}
