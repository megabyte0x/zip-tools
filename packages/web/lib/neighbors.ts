import type { ZipRecord } from "./types";

export function prevNext(
  zips: ZipRecord[],
  number: number,
): { prev: ZipRecord | null; next: ZipRecord | null } {
  const numbered = zips
    .filter((zip): zip is ZipRecord & { number: number } => zip.number != null)
    .sort((a, b) => a.number - b.number);
  const index = numbered.findIndex((zip) => zip.number === number);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: numbered[index - 1] ?? null,
    next: numbered[index + 1] ?? null,
  };
}
