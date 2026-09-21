import { filterZips } from "./filter";
import type { ZipRecord } from "./types";
import { zipHref } from "./zipHref";

export function searchSuggestions(
  zips: ZipRecord[],
  text: string,
  limit = 8,
): { id: string; href: string; label: string }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return filterZips(zips, { text: trimmed })
    .slice(0, limit)
    .map((zip) => ({
      id: zip.id,
      href: zipHref(zip),
      label: zip.number != null ? `${zip.number} — ${zip.title}` : `Draft — ${zip.title}`,
    }));
}
