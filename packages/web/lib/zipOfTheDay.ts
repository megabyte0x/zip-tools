import { createHash } from "node:crypto";
import type { ZipRecord } from "./types";

export function zipOfTheDay(zips: ZipRecord[], utcDate: string): ZipRecord | null {
  const numbered = zips
    .filter((zip): zip is ZipRecord & { number: number } => zip.number != null)
    .sort((a, b) => a.number - b.number);
  if (numbered.length === 0) return null;
  const digest = createHash("sha256").update(`zip-of-the-day:${utcDate}`).digest("hex");
  const index = Number(BigInt(`0x${digest}`) % BigInt(numbered.length));
  return numbered[index] ?? null;
}
