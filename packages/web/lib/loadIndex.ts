import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZipIndexFile } from "./types";

export function loadIndex(): ZipIndexFile {
  const indexPath =
    process.env.ZIP_INDEX_PATH ?? join(process.cwd(), "data", "zip-index.json");
  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf8");
  } catch (err) {
    throw new Error(`zip index not found: ${indexPath}`, { cause: err });
  }
  return JSON.parse(raw) as ZipIndexFile;
}
