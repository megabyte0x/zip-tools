import type { ZipRecord } from "./types.ts";

export function draftShortId(slug: string): string {
  const stripped = slug.startsWith("draft-") ? slug.slice("draft-".length) : slug;
  return stripped.length > 0 ? stripped : slug;
}

export function zipIdentityParts(
  zip: Pick<ZipRecord, "number" | "slug">,
): { prefix: "ZIP" | "Draft"; id: string } {
  return zip.number != null
    ? { prefix: "ZIP", id: String(zip.number) }
    : { prefix: "Draft", id: draftShortId(zip.slug) };
}

export function zipIdentityLabel(zip: Pick<ZipRecord, "number" | "slug">): string {
  const { prefix, id } = zipIdentityParts(zip);
  return `${prefix} ${id}`;
}
