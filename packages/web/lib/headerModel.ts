import type { NuEntry, ZipRecord } from "./types";

export function headerModel(index: { zips: ZipRecord[]; nus: NuEntry[] }): {
  browseCount: number;
  draftCount: number;
  nus: { id: string; href: string }[];
} {
  const draftCount = index.zips.filter((zip) => zip.number === null).length;
  const nus = [...index.nus]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((nu) => ({ id: nu.id, href: `/nu/${nu.id}` }));
  return { browseCount: index.zips.length, draftCount, nus };
}

/** Home and Browse carry their own search box, so the header copy would be a second one. */
export function showHeaderSearch(pathname: string): boolean {
  return pathname !== "/" && pathname !== "/zips";
}
