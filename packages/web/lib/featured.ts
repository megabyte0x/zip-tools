import type { ZipIndexFile, ZipRecord } from "./types";

function createdThenNumberDesc(a: ZipRecord, b: ZipRecord): number {
  if (a.created == null && b.created == null) {
    return (b.number ?? 0) - (a.number ?? 0);
  }
  if (a.created == null) return 1;
  if (b.created == null) return -1;
  if (a.created !== b.created) return a.created < b.created ? 1 : -1;
  return (b.number ?? 0) - (a.number ?? 0);
}

export function featuredZips(index: ZipIndexFile, recentLimit = 12): ZipRecord[] {
  const byNumber = new Map<number, ZipRecord>();
  for (const zip of index.zips) {
    if (zip.number != null) byNumber.set(zip.number, zip);
  }

  const selected = new Map<number, ZipRecord>();
  for (const nu of index.nus) {
    if (nu.kind !== "candidate") continue;
    for (const number of nu.zips) {
      const zip = byNumber.get(number);
      if (zip) selected.set(number, zip);
    }
  }

  const recent = [...byNumber.values()].sort(createdThenNumberDesc).slice(0, recentLimit);
  for (const zip of recent) {
    if (zip.number != null) selected.set(zip.number, zip);
  }

  return [...selected.values()].sort(createdThenNumberDesc);
}
