import type { NuEntry, ZipRecord } from "./types";

export function headerModel(index: { zips: ZipRecord[]; nus: NuEntry[] }): {
  zipCount: number;
  draftCount: number;
  nus: { id: string; href: string }[];
} {
  let zipCount = 0;
  let draftCount = 0;
  for (const zip of index.zips) {
    if (zip.number === null) draftCount += 1;
    else zipCount += 1;
  }
  const nus = [...index.nus]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((nu) => ({ id: nu.id, href: `/nu/${nu.id}` }));
  return { zipCount, draftCount, nus };
}
