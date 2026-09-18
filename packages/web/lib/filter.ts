import type { ZipRecord } from "./types";

export type ZipFilterQuery = {
  text?: string;
  status?: string;
  nuId?: string;
  category?: string;
};

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function filterZips(zips: ZipRecord[], q: ZipFilterQuery): ZipRecord[] {
  const text = q.text?.trim() ?? "";
  const status = q.status?.trim() ?? "";
  const nuId = q.nuId?.trim() ?? "";
  const category = q.category?.trim() ?? "";

  return zips.filter((zip) => {
    if (text) {
      const numberText = zip.number == null ? "" : String(zip.number);
      const ownerText = zip.owners.map((owner) => owner.name).join("\0");
      const matched =
        includesInsensitive(numberText, text) ||
        includesInsensitive(zip.title, text) ||
        includesInsensitive(ownerText, text);
      if (!matched) return false;
    }

    if (status) {
      const statusMatched =
        includesInsensitive(zip.statusRaw, status) ||
        zip.status.some((entry) => includesInsensitive(entry.label, status));
      if (!statusMatched) return false;
    }

    if (nuId) {
      const nuMatched = zip.nuIds.some((id) => includesInsensitive(id, nuId));
      if (!nuMatched) return false;
    }

    if (category) {
      if (!zip.category || !includesInsensitive(zip.category, category)) {
        return false;
      }
    }

    return true;
  });
}
