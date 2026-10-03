import type { StatusEntry } from "./types.ts";

const KNOWN_LABEL =
  "Draft|Proposed|Active|Final|Withdrawn|Rejected|Obsolete|Reserved";

const BRACKETED_REVISION_RE =
  /^\[Revision\s+(?<rev>\d+)(?:\s*:\s*(?<meta>[^\]]+))?\]\s*(?<status>.*)$/i;
const PLAIN_REVISION_RE =
  /^Revision\s+(?<rev>\d+)(?::\s*(?<details>.*)|\s+(?<status>.*))$/i;
const STATUS_RE = new RegExp(`\\b(${KNOWN_LABEL})\\b`, "i");

export function parseStatus(raw: string): StatusEntry[] {
  return splitOutsideBrackets(raw).flatMap(expandBracketGroup);
}

/** Commas inside `[...]` belong to one revision group, not to the next status. */
function splitOutsideBrackets(raw: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "[") depth++;
    else if (ch === "]" && depth > 0) depth--;
    else if (ch === "," && depth === 0 && /^\s*\[?Revision\b/i.test(raw.slice(i + 1))) {
      chunks.push(raw.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(raw.slice(start));
  return chunks;
}

function expandBracketGroup(chunk: string): StatusEntry[] {
  const trimmed = chunk.trim();
  const group = trimmed.match(/^\[(?<inside>[^\]]+)\]\s*(?<status>.*)$/);
  const inside = group?.groups?.inside;
  if (!inside || !/,\s*Revision\b/i.test(inside)) return [parseChunk(trimmed)];

  const status = group?.groups?.status?.trim() ?? "";
  return inside.split(/,\s*(?=Revision\b)/i).map((part) => {
    const wrapped = `[${part.trim()}]${status ? ` ${status}` : ""}`;
    return parseChunk(wrapped);
  });
}

function parseChunk(chunk: string): StatusEntry {
  const trimmed = chunk.trim();
  const revisionMatch = trimmed.match(BRACKETED_REVISION_RE);
  const plainRevisionMatch = revisionMatch ? null : trimmed.match(PLAIN_REVISION_RE);
  const revision = revisionMatch ?? plainRevisionMatch;
  const statusText =
    revisionMatch?.groups?.status?.trim() ??
    plainRevisionMatch?.groups?.details?.trim() ??
    plainRevisionMatch?.groups?.status?.trim() ??
    trimmed;
  const statusMatch = statusText.match(STATUS_RE);
  const label = statusMatch?.[1];
  const normalizedLabel = label
    ? KNOWN_LABEL.split("|").find((known) => known.toLowerCase() === label.toLowerCase())
    : undefined;
  const entry: StatusEntry = { label: normalizedLabel ?? statusText };

  if (revision?.groups?.rev !== undefined) {
    entry.revision = revision.groups.rev;
  }

  const labelIndex = statusMatch?.index ?? -1;
  const metadata =
    revisionMatch?.groups?.meta?.trim() ??
    (plainRevisionMatch?.groups?.details && labelIndex >= 0
      ? statusText.slice(0, labelIndex).replace(/:$/, "").trim()
      : undefined);
  const proposedNu = statusText.match(/^Proposed\s+for\s+(NU[^\s\]]+)/i)?.[1];
  const nuHint = metadata?.match(/\b(NU[^\s\]]+)/i)?.[1] ?? proposedNu;
  if (nuHint) entry.nuHint = nuHint;

  return entry;
}
