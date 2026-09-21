import type { ZipRecord } from "./types";

export type ZipFilterQuery = {
  text?: string;
  status?: string;
  nuId?: string;
  category?: string;
  kind?: "draft" | "numbered" | "";
  sort?: "number" | "title";
};

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

function equalsInsensitive(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: "accent" }) === 0;
}

export function filterZips(zips: ZipRecord[], q: ZipFilterQuery): ZipRecord[] {
  const text = q.text?.trim() ?? "";
  const status = q.status?.trim() ?? "";
  const nuId = q.nuId?.trim() ?? "";
  const category = q.category?.trim() ?? "";

  const filtered = zips.filter((zip) => {
    if (text) {
      const numberText = zip.number == null ? "" : String(zip.number);
      const ownerText = zip.owners.map((owner) => owner.name).join("\0");
      const matched =
        includesInsensitive(numberText, text) ||
        includesInsensitive(zip.title, text) ||
        includesInsensitive(ownerText, text);
      if (!matched) return false;
    }

    if (status && !zip.status.some((entry) => equalsInsensitive(entry.label, status))) {
      return false;
    }

    if (nuId && !zip.nuIds.some((id) => equalsInsensitive(id, nuId))) {
      return false;
    }

    if (category && (!zip.category || !equalsInsensitive(zip.category, category))) {
      return false;
    }

    if (q.kind === "draft" && zip.number !== null) return false;
    if (q.kind === "numbered" && zip.number === null) return false;

    return true;
  });

  return filtered
    .map((zip, index) => ({ zip, index }))
    .sort((left, right) => {
      let order = 0;
      if (q.sort === "title") {
        order = left.zip.title.localeCompare(right.zip.title, undefined, {
          sensitivity: "base",
        });
      } else if (left.zip.number == null || right.zip.number == null) {
        if (left.zip.number == null && right.zip.number != null) order = 1;
        if (left.zip.number != null && right.zip.number == null) order = -1;
      } else {
        order = left.zip.number - right.zip.number;
      }
      return order || left.index - right.index;
    })
    .map(({ zip }) => zip);
}
