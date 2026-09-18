import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, writeIndex } from "./build.ts";
import { readSnapshotMeta } from "./snapshot.ts";
import type { NuOverlay } from "./types.ts";

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

function main(): void {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] !== "build") {
      throw new Error("usage: zip-index build --source <dir> --out <dir>");
    }
    const sourceDir = argValue(argv, "--source");
    const outDir = argValue(argv, "--out");
    if (!sourceDir || !outDir) {
      throw new Error("usage: zip-index build --source <dir> --out <dir>");
    }

    const overlayPath = join(dirname(fileURLToPath(import.meta.url)), "..", "nu.json");
    const overlay = JSON.parse(readFileSync(overlayPath, "utf8")) as NuOverlay;
    const meta = readSnapshotMeta(sourceDir);
    const index = buildIndex({
      sourceDir,
      overlay,
      sha: meta.sha,
      date: meta.date,
    });
    writeIndex(outDir, index);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
