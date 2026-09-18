import type { Owner } from "./types.ts";

export type ParsedHeader = {
  number: number | null;
  title: string;
  owners: Owner[];
  statusRaw: string;
  category: string | null;
  created: string | null;
  license: string | null;
  discussionsTo: string | null;
  requires: number[];
  warnings: string[];
};

function isUnderlineHeading(line: string): boolean {
  return /^=+$/.test(line.trim());
}

function isAtxHeading(line: string): boolean {
  return /^#\s/.test(line.trim());
}

function parseOwner(line: string): Owner {
  const m = line.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: line.trim() };
}

function parseIntOrNull(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

export function parseHeader(text: string): ParsedHeader {
  const allLines = text.split(/\r?\n/);
  const headerLines: string[] = [];
  for (const line of allLines) {
    if (isUnderlineHeading(line) || isAtxHeading(line)) break;
    headerLines.push(line);
  }

  let start = 0;
  while (start < headerLines.length && headerLines[start].trim() === "") start++;
  if (headerLines[start]?.trim() === "::") start++;

  const fields = new Map<string, string[]>();
  let currentKey: string | null = null;

  for (let i = start; i < headerLines.length; i++) {
    const line = headerLines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      currentKey = null;
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    const isKeyValue = colonIdx > 0 && !trimmed.slice(0, colonIdx).includes(" ");
    if (isKeyValue) {
      currentKey = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      const parts = fields.get(currentKey) ?? [];
      if (value !== "") parts.push(value);
      fields.set(currentKey, parts);
    } else if (currentKey !== null && /^\s/.test(line)) {
      fields.get(currentKey)!.push(trimmed);
    } else {
      currentKey = null;
    }
  }

  const get = (key: string): string | undefined => fields.get(key)?.join("\n");
  const warnings: string[] = [];

  const zipRaw = get("ZIP");
  const number = zipRaw === undefined ? null : parseIntOrNull(zipRaw);

  const title = get("Title") ?? "";
  if (!fields.has("Title")) warnings.push("missing Title");

  const statusRaw = get("Status") ?? "";
  if (!fields.has("Status")) warnings.push("missing Status");

  const ownersRaw = fields.get("Owners") ?? [];
  const owners = ownersRaw.map(parseOwner);

  const category = get("Category") ?? null;
  const created = get("Created") ?? null;
  const license = get("License") ?? null;

  const discussionsRaw = get("Discussions-To");
  const discussionsTo =
    discussionsRaw === undefined ? null : discussionsRaw.replace(/^<|>$/g, "");

  const requiresRaw = get("Requires");
  const requires =
    requiresRaw === undefined
      ? []
      : requiresRaw
          .split(/[,\s]+/)
          .map((s) => parseIntOrNull(s))
          .filter((n): n is number => n !== null);

  return {
    number,
    title,
    owners,
    statusRaw,
    category,
    created,
    license,
    discussionsTo,
    requires,
    warnings,
  };
}
