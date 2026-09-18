import type { ZipIndexFile, ZipRecord } from "./types";

function parseZipNumber(raw: string): number | null {
  const match = /^(?:zip-)?0*(\d+)$/i.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]);
}

export function resolveZip(index: ZipIndexFile, raw: string): ZipRecord | null {
  const number = parseZipNumber(raw);
  if (number === null) return null;
  return index.zips.find((zip) => zip.number === number) ?? null;
}

export function resolveDraft(index: ZipIndexFile, slug: string): ZipRecord | null {
  return index.zips.find((zip) => zip.slug === slug) ?? null;
}
