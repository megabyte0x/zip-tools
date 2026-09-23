import { readFileSync } from "node:fs";
import { join } from "node:path";
import bundledIndex from "../data/zip-index.json";
import type { ZipIndexFile } from "./types";

const embeddedIndex = bundledIndex as ZipIndexFile;

export function loadIndex(): ZipIndexFile {
  const indexPath = process.env.ZIP_INDEX_PATH;
  if (indexPath === undefined) return embeddedIndex;

  const resolvedIndexPath = indexPath || join(process.cwd(), "data", "zip-index.json");
  let raw: string;
  try {
    raw = readFileSync(resolvedIndexPath, "utf8");
  } catch (err) {
    throw new Error(`zip index not found: ${resolvedIndexPath}`, { cause: err });
  }
  return JSON.parse(raw) as ZipIndexFile;
}
