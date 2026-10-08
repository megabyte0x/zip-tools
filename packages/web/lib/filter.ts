import type { ZipRecord } from "./types";

export type ZipFilterQuery = {
  text?: string;
  status?: string;
  nuId?: string;
  category?: string;
  kind?: "draft" | "numbered" | "";
  sort?: "number" | "title";
};

function equalsInsensitive(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: "accent" }) === 0;
}

export function filterZips<
  T extends Pick<ZipRecord, "number" | "title" | "owners" | "status" | "nuIds" | "category">,
>(zips: T[], q: ZipFilterQuery): T[] {
  const text = q.text?.trim().toLocaleLowerCase() ?? "";
  const status = q.status?.trim() ?? "";
  const nuId = q.nuId?.trim() ?? "";
  const category = q.category?.trim() ?? "";

  const filtered = zips.filter((zip) => {
    if (text) {
      const numberText = zip.number == null ? "" : String(zip.number);
      const ownerText = zip.owners.map((owner) => owner.name).join("\0");
      const matched =
        numberText.includes(text) ||
        zip.title.toLocaleLowerCase().includes(text) ||
        ownerText.toLocaleLowerCase().includes(text);
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

  return filtered.sort((left, right) => q.sort === "title"
    ? left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
    : (left.number ?? Infinity) - (right.number ?? Infinity));
}
