import type { ZipRecord } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-13" or an ISO timestamp -> "Jun 13, 2026", read in UTC. */
export function formatDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Proposals with a Created date, newest first; ties go to the higher number. */
export function newestZips(zips: ZipRecord[], limit = Number.POSITIVE_INFINITY): ZipRecord[] {
  return zips
    .filter((zip) => zip.created != null && formatDay(zip.created) != null)
    .sort((a, b) => {
      if (a.created !== b.created) return (a.created ?? "") < (b.created ?? "") ? 1 : -1;
      return (b.number ?? -1) - (a.number ?? -1);
    })
    .slice(0, limit);
}
