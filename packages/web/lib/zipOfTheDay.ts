import { createHash } from "node:crypto";
import type { ZipRecord } from "./types";

export { zotdRows, type ZotdRow } from "./zotdRows";

export type ZipOfTheDayZip = Pick<
  ZipRecord,
  | "number"
  | "slug"
  | "title"
  | "status"
  | "statusRaw"
  | "category"
  | "owners"
  | "created"
  | "discussionsTo"
  | "officialUrl"
  | "githubUrl"
>;

export function slimZipOfTheDay(zip: ZipRecord): ZipOfTheDayZip {
  return {
    number: zip.number,
    slug: zip.slug,
    title: zip.title,
    status: zip.status,
    statusRaw: zip.statusRaw,
    category: zip.category,
    owners: zip.owners.map((owner) => ({ name: owner.name })),
    created: zip.created,
    discussionsTo: zip.discussionsTo,
    officialUrl: zip.officialUrl,
    githubUrl: zip.githubUrl,
  };
}

export function zipOfTheDay(zips: ZipRecord[], utcDate: string): ZipRecord | null {
  const numbered = zips
    .filter((zip): zip is ZipRecord & { number: number } => zip.number != null)
    .sort((a, b) => a.number - b.number);
  if (numbered.length === 0) return null;
  const digest = createHash("sha256").update(`zip-of-the-day:${utcDate}`).digest("hex");
  const index = Number(BigInt(`0x${digest}`) % BigInt(numbered.length));
  return numbered[index] ?? null;
}
