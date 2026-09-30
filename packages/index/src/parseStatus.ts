import type { StatusEntry } from "./types.ts";

const KNOWN_LABEL =
  "Draft|Proposed|Active|Final|Withdrawn|Rejected|Obsolete|Reserved";

const BRACKETED_REVISION_RE =
  /^\[Revision\s+(?<rev>\d+)(?:\s*:\s*(?<meta>[^\]]+))?\]\s*(?<status>.*)$/i;
const PLAIN_REVISION_RE =
  /^Revision\s+(?<rev>\d+)(?::\s*(?<details>.*)|\s+(?<status>.*))$/i;
const STATUS_RE = new RegExp(`\\b(${KNOWN_LABEL})\\b`, "i");

export function parseStatus(raw: string): StatusEntry[] {
  const chunks = raw.split(/,\s*(?=\[?Revision\b)/i);
  return chunks.map(parseChunk);
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
  const proposedNu = statusText.match(/^Proposed\s+for\s+(NU\S+)/i)?.[1];
  const nuHint = metadata?.match(/\b(NU\S+)/i)?.[1] ?? proposedNu;
  if (nuHint) entry.nuHint = nuHint;

  return entry;
}
