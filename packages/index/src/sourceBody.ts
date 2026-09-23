const metadataFieldNames = new Set([
  "ZIP",
  "Title",
  "Owners",
  "Status",
  "Category",
  "Created",
  "License",
  "Discussions-To",
  "Requires",
  "Pull-Request",
  "Credits",
]);

type FieldLine = {
  indent: number;
  name: string;
};

function indentation(line: string): number {
  return /^[ \t]*/.exec(line)?.[0].length ?? 0;
}

function parseFieldLine(line: string): FieldLine | null {
  const match = /^([ \t]*)([A-Za-z][A-Za-z-]*):(?:[ \t]*.*)?$/.exec(line);
  if (!match) return null;

  return { indent: match[1].length, name: match[2] };
}

function isMetadataField(field: FieldLine | null): field is FieldLine {
  return field !== null && metadataFieldNames.has(field.name);
}

function hasRequiredFields(fields: Set<string>): boolean {
  return fields.has("ZIP") && fields.has("Title");
}

function isFence(line: string, indent: string): boolean {
  return line.startsWith(indent) && /^---[ \t]*$/.test(line.slice(indent.length));
}

function scanFencedFrontMatter(lines: string[], start: number): number | null {
  const opening = /^([ \t]*)---[ \t]*$/.exec(lines[start]);
  if (!opening) return null;

  const fields = new Set<string>();
  const fenceIndent = opening[1];
  let currentFieldIndent: number | null = null;

  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (isFence(line, fenceIndent)) {
      return hasRequiredFields(fields) ? index + 1 : null;
    }

    if (line.trim() === "") {
      currentFieldIndent = null;
      continue;
    }

    const field = parseFieldLine(line);
    if (field !== null) {
      if (!isMetadataField(field) || field.indent !== fenceIndent.length) return null;
      fields.add(field.name);
      currentFieldIndent = field.indent;
      continue;
    }

    if (currentFieldIndent !== null && indentation(line) > currentFieldIndent) continue;
    return null;
  }

  return null;
}

function scanIndentedRfc822Header(lines: string[], start: number): number | null {
  let index = start;
  if (lines[index]?.trim() === "::") {
    index++;
    while (lines[index]?.trim() === "") index++;
  }

  const firstField = parseFieldLine(lines[index] ?? "");
  if (!isMetadataField(firstField) || firstField.indent === 0) return null;

  const fields = new Set<string>();
  const fieldIndent = firstField.indent;
  let currentFieldIndent: number | null = null;

  for (; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") {
      return hasRequiredFields(fields) ? index + 1 : null;
    }

    const field = parseFieldLine(line);
    if (field !== null) {
      if (!isMetadataField(field) || field.indent !== fieldIndent) {
        return hasRequiredFields(fields) ? index : null;
      }
      fields.add(field.name);
      currentFieldIndent = field.indent;
      continue;
    }

    if (currentFieldIndent !== null && indentation(line) > currentFieldIndent) continue;
    return hasRequiredFields(fields) ? index : null;
  }

  return hasRequiredFields(fields) ? index : null;
}

function scanLeadingPreamble(normalizedSource: string): string | null {
  const lines = normalizedSource.split("\n");
  let start = 0;
  while (lines[start]?.trim() === "") start++;

  const afterFrontMatter = scanFencedFrontMatter(lines, start);
  const afterHeader =
    afterFrontMatter ?? scanIndentedRfc822Header(lines, start);
  return afterHeader === null ? null : lines.slice(afterHeader).join("\n");
}

export function hasSubstantiveBody(source: string | null): boolean {
  if (source === null) return false;

  const normalizedSource = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
  const sourceAfterPreamble = scanLeadingPreamble(normalizedSource);

  return (sourceAfterPreamble ?? normalizedSource).trim().length > 0;
}
