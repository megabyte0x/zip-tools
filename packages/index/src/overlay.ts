import type { NuOverlay, ZipRecord } from "./types.ts";

export function applyOverlay(
  zips: ZipRecord[],
  overlay: NuOverlay,
): { zips: ZipRecord[]; missing: { nuId: string; number: number }[] } {
  const byNumber = new Map<number, ZipRecord>();
  const next = zips.map((z) => {
    const copy = { ...z, nuIds: [...z.nuIds] };
    if (copy.number !== null) byNumber.set(copy.number, copy);
    return copy;
  });

  const missing: { nuId: string; number: number }[] = [];
  for (const nu of overlay.nus) {
    for (const number of nu.zips) {
      const rec = byNumber.get(number);
      if (rec) rec.nuIds.push(nu.id);
      else missing.push({ nuId: nu.id, number });
    }
  }

  return { zips: next, missing };
}
