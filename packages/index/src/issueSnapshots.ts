import { createHash, randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import type {
  IssueRef,
  IssueSnapshotFile,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;

const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;
const ISO_UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownField(record: UnknownRecord, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    throw new Error(`Missing issue snapshot field: ${key}`);
  }
  return record[key];
}

function isIsoUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_UTC_TIMESTAMP.exec(value);
  if (match === null) return false;

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const date = new Date(parsed);
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]) &&
    date.getUTCHours() === Number(match[4]) &&
    date.getUTCMinutes() === Number(match[5]) &&
    date.getUTCSeconds() === Number(match[6])
  );
}

export function parseIssueRef(value: string | null): IssueRef | null {
  if (value === null) return null;
  const match = /^https:\/\/github\.com\/zcash\/zips\/issues\/([1-9]\d*)$/.exec(value);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) ? { url: value, number } : null;
}

export function issueBodyHash(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function validateIssueSnapshotFile(value: unknown): IssueSnapshotFile {
  if (!isRecord(value)) throw new Error("Issue snapshot file must be an object");

  const version = ownField(value, "version");
  if (version !== 1) throw new Error("Unsupported issue snapshot version");

  const issues = ownField(value, "issues");
  if (!isRecord(issues)) throw new Error("Issue snapshots must be an object");

  for (const [key, candidate] of Object.entries(issues)) {
    if (!isRecord(candidate)) throw new Error(`Invalid issue snapshot entry: ${key}`);

    const url = ownField(candidate, "url");
    if (typeof url !== "string") throw new Error(`Invalid issue URL: ${key}`);
    const ref = parseIssueRef(url);
    if (ref === null || key !== url) throw new Error(`Mismatched issue URL: ${key}`);

    const number = ownField(candidate, "number");
    if (!Number.isSafeInteger(number) || number !== ref.number) {
      throw new Error(`Invalid issue number: ${key}`);
    }

    const title = ownField(candidate, "title");
    if (typeof title !== "string" || title.length === 0) {
      throw new Error(`Invalid issue title: ${key}`);
    }

    const body = ownField(candidate, "body");
    if (typeof body !== "string" || body.length === 0) {
      throw new Error(`Invalid issue body: ${key}`);
    }

    const updatedAt = ownField(candidate, "updatedAt");
    if (!isIsoUtcTimestamp(updatedAt)) {
      throw new Error(`Invalid issue updatedAt: ${key}`);
    }

    const fetchedAt = ownField(candidate, "fetchedAt");
    if (!isIsoUtcTimestamp(fetchedAt)) {
      throw new Error(`Invalid issue fetchedAt: ${key}`);
    }

    const contentHash = ownField(candidate, "contentHash");
    if (
      typeof contentHash !== "string" ||
      !LOWERCASE_SHA256.test(contentHash) ||
      contentHash !== issueBodyHash(body)
    ) {
      throw new Error(`Invalid issue content hash: ${key}`);
    }
  }

  return value as IssueSnapshotFile;
}

export function readIssueSnapshots(path: string): IssueSnapshotFile {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error: unknown) {
    if (
      isRecord(error) &&
      Object.prototype.hasOwnProperty.call(error, "code") &&
      error["code"] === "ENOENT"
    ) {
      return { version: 1, issues: {} };
    }
    throw error;
  }

  return validateIssueSnapshotFile(JSON.parse(contents));
}

export function writeIssueSnapshots(
  path: string,
  snapshots: IssueSnapshotFile,
): void {
  const validated = validateIssueSnapshotFile(snapshots);
  const sorted = {
    version: validated.version,
    issues: Object.fromEntries(
      Object.entries(validated.issues).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
  };
  const sibling = `${path}.${randomUUID()}.tmp`;

  try {
    writeFileSync(sibling, `${JSON.stringify(sorted, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(sibling, path);
  } finally {
    rmSync(sibling, { force: true });
  }
}
