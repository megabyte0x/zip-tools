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
