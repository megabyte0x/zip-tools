import { spawnSync } from "node:child_process";

export type SnapshotMeta = {
  sha: string;
  date: string;
  url: string;
};

const FIXTURE_META: SnapshotMeta = { sha: "fixture", date: "", url: "" };

export function readSnapshotMeta(sourceDir: string): SnapshotMeta {
  const sha = spawnSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (sha.error || sha.status !== 0) return FIXTURE_META;
  const shaStr = sha.stdout.trim();
  if (!shaStr) return FIXTURE_META;

  const log = spawnSync("git", ["-C", sourceDir, "log", "-1", "--format=%cI"], {
    encoding: "utf8",
  });
  if (log.error || log.status !== 0) return FIXTURE_META;
  const date = log.stdout.trim();

  return {
    sha: shaStr,
    date,
    url: `https://github.com/zcash/zips/commit/${shaStr}`,
  };
}

/**
 * When each source file last changed on the main line, keyed by its path relative to sourceDir.
 * Merges count at their merge date, when the change was published. A shallow clone reports
 * every file at its single commit's date; no git history yields an empty map.
 */
export function readSourceDates(sourceDir: string): Record<string, string> {
  const log = spawnSync(
    "git",
    ["-C", sourceDir, "log", "--first-parent", "--diff-merges=first-parent", "--no-renames", "--relative", "--name-only", "--format=@%cI"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const dates: Record<string, string> = {};
  if (log.error || log.status !== 0) return dates;
  let date = "";
  for (const line of log.stdout.split("\n")) {
    if (line.startsWith("@")) date = line.slice(1);
    else if (line && !Object.hasOwn(dates, line)) dates[line] = date;
  }
  return dates;
}
