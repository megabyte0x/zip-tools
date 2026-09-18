import type { ZipIndexFile, ZipRecord } from "./types";

export type NuRow =
  | { number: number; record: ZipRecord }
  | { number: number; record: null };

export function nuRows(index: ZipIndexFile, nuId: string): NuRow[] | null {
  const nu = index.nus.find((n) => n.id === nuId);
  if (!nu) return null;
  return nu.zips.map((number) => ({
    number,
    record: index.zips.find((z) => z.number === number) ?? null,
  }));
}
