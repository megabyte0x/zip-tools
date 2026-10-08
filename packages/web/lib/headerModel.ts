import type { ZipRecord } from "./types";

export function headerModel(index: { zips: ZipRecord[] }): {
  browseCount: number;
  draftCount: number;
} {
  const draftCount = index.zips.filter((zip) => zip.number === null).length;
  return { browseCount: index.zips.length, draftCount };
}

/** Home and Browse carry their own search box, so the header copy would be a second one. */
export function showHeaderSearch(pathname: string): boolean {
  return pathname !== "/" && pathname !== "/zips";
}
