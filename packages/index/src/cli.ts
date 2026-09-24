import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, writeIndex } from "./build.ts";
import { parseIssueRef, readIssueSnapshots, writeIssueSnapshots } from "./issueSnapshots.ts";
import { refreshIssueSnapshots } from "./refreshIssues.ts";
import { readSnapshotMeta } from "./snapshot.ts";
import type { NuOverlay } from "./types.ts";
import { degradedSummary } from "./degraded.ts";

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

function buildUsage(): string {
  return "usage: zip-index build --source <dir> --out <dir> [--snapshots <path>]";
}

function refreshUsage(): string {
  return "usage: zip-index refresh-issues --source <dir> --snapshots <path>";
}

function buildInputs(sourceDir: string) {
  const overlayPath = join(dirname(fileURLToPath(import.meta.url)), "..", "nu.json");
  return {
    overlay: JSON.parse(readFileSync(overlayPath, "utf8")) as NuOverlay,
    meta: readSnapshotMeta(sourceDir),
  };
}

function refreshRefs(sourceDir: string) {
  const { overlay, meta } = buildInputs(sourceDir);
  const index = buildIndex({ sourceDir, overlay, sha: meta.sha, date: meta.date });
  return index.zips.flatMap((record) => {
    if (record.body !== null) return [];
    const ref = parseIssueRef(record.discussionsTo);
    return ref === null ? [] : [ref];
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] === "build") {
      const sourceDir = argValue(argv, "--source");
      const outDir = argValue(argv, "--out");
      if (!sourceDir || !outDir) throw new Error(buildUsage());
      const snapshotsPath = argValue(argv, "--snapshots");
      if (argv.includes("--snapshots") && !snapshotsPath) {
        throw new Error("--snapshots requires a path");
      }

      const { overlay, meta } = buildInputs(sourceDir);
      const issueSnapshots = snapshotsPath
        ? readIssueSnapshots(snapshotsPath)
        : { version: 1 as const, issues: {} };
      const index = buildIndex({
        sourceDir,
        overlay,
        sha: meta.sha,
        date: meta.date,
        issueSnapshots,
      });
      writeIndex(outDir, index);
      const degraded = degradedSummary(index.zips);
      if (degraded) console.error(degraded);
      return;
    }

    if (argv[0] === "refresh-issues") {
      const sourceDir = argValue(argv, "--source");
      const snapshotsPath = argValue(argv, "--snapshots");
      if (!sourceDir || !snapshotsPath) throw new Error(refreshUsage());
      const previous = readIssueSnapshots(snapshotsPath);
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      const result = await refreshIssueSnapshots(refreshRefs(sourceDir), previous, {
        fetchImpl: fetch,
        now: () => new Date().toISOString(),
        ...(token ? { token } : {}),
      });
      writeIssueSnapshots(snapshotsPath, result.snapshots);
      for (const url of result.refreshed) console.log(`refreshed ${url}`);
      for (const failure of result.failures) {
        console.error(`failed ${failure.url}: ${failure.reason}`);
      }
      if (result.failures.length > 0) process.exitCode = 1;
      return;
    }

    throw new Error(`${buildUsage()}\n${refreshUsage()}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

void main();
