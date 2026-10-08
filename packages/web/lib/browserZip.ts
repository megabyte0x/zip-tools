import type { ZipRecord } from "./types";

export type BrowserZip = Pick<
  ZipRecord,
  "id" | "number" | "slug" | "title" | "status" | "statusRaw" | "category" | "owners" | "nuIds" | "citations"
>;

export function browserZip(zip: ZipRecord): BrowserZip {
  const { id, number, slug, title, status, statusRaw, category, owners, nuIds, citations } = zip;
  return {
    id, number, slug, title, status, statusRaw, category,
    owners: owners.map(({ name }) => ({ name })),
    nuIds, citations,
  };
}
