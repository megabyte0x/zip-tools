import type { ZipIndexFile } from "./types";
import { formatDay } from "./recent";

export function footerLabel(snapshot: ZipIndexFile["snapshot"]): string {
  const base = `Synced from zcash/zips @ ${snapshot.sha.slice(0, 7)}`;
  const day = formatDay(snapshot.date);
  return day ? `${base} · ${day}` : base;
}
