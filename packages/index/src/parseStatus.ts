import type { StatusEntry } from "./types.ts";

const KNOWN_LABEL =
  "Draft|Proposed|Active|Final|Withdrawn|Rejected|Obsolete|Reserved";

const REVISION_RE =
  /Revision (?<rev>\d+)(?::\s*(?<nu>[^,]+?))?\s+(?<label>Draft|Proposed|Active|Final|Withdrawn|Rejected|Obsolete|Reserved)/;

const BARE_LABEL_RE = new RegExp(`^(?:${KNOWN_LABEL})$`);

export function parseStatus(raw: string): StatusEntry[] {
  const chunks = raw.split(/,\s*(?=Revision)/);
  return chunks.map((chunk) => parseChunk(chunk));
}

function parseChunk(chunk: string): StatusEntry {
  const trimmed = chunk.trim();
  const revisionMatch = trimmed.match(REVISION_RE);
  if (revisionMatch?.groups) {
    const entry: StatusEntry = { label: revisionMatch.groups.label };
    if (revisionMatch.groups.rev !== undefined) {
      entry.revision = revisionMatch.groups.rev;
    }
    if (revisionMatch.groups.nu !== undefined && revisionMatch.groups.nu !== "") {
      entry.nuHint = revisionMatch.groups.nu;
    }
    return entry;
  }
  if (BARE_LABEL_RE.test(trimmed)) {
    return { label: trimmed };
  }
  return { label: trimmed };
}
