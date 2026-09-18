import type { ZipRecord } from "./types";

export function zipHref(zip: Pick<ZipRecord, "number" | "slug">): string {
  return zip.number != null ? `/zip/${zip.number}` : `/draft/${zip.slug}`;
}
