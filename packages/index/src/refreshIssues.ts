import {
  issueBodyHash,
  parseIssueRef,
  validateIssueSnapshotFile,
} from "./issueSnapshots.ts";
import type { IssueRef, IssueSnapshot, IssueSnapshotFile } from "./types.ts";

type UnknownRecord = Record<string, unknown>;

export type RefreshFailureReason =
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "server-error"
  | "http-error"
  | "network-error"
  | "invalid-json"
  | "invalid-response";

export type RefreshFailure = { url: string; reason: RefreshFailureReason };

export type RefreshIssueSnapshotsOptions = {
  fetchImpl: typeof fetch;
  now: () => string;
  token?: string;
};

export type RefreshIssueSnapshotsResult = {
  snapshots: IssueSnapshotFile;
  refreshed: string[];
  failures: RefreshFailure[];
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownString(value: UnknownRecord, key: string): string | null {
  if (!Object.hasOwn(value, key) || typeof value[key] !== "string") return null;
  return value[key] as string;
}

function clonePrevious(previous: IssueSnapshotFile): IssueSnapshotFile {
  const validated = validateIssueSnapshotFile(previous);
  return {
    version: 1,
    issues: Object.fromEntries(
      Object.entries(validated.issues).map(([url, issue]) => [url, { ...issue }]),
    ),
  };
}

function httpFailureReason(status: number): RefreshFailureReason {
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500 && status <= 599) return "server-error";
  return "http-error";
}

function candidateFromResponse(
  value: unknown,
  ref: IssueRef,
  fetchedAt: string,
): IssueSnapshot | null {
  if (!isRecord(value) || Object.hasOwn(value, "pull_request")) return null;

  const url = ownString(value, "html_url");
  const title = ownString(value, "title");
  const body = ownString(value, "body");
  const updatedAt = ownString(value, "updated_at");
  const number = value.number;
  if (
    url !== ref.url ||
    !Number.isSafeInteger(number) ||
    number !== ref.number ||
    title === null ||
    title.length === 0 ||
    body === null ||
    body.length === 0 ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    url,
    number,
    title,
    body,
    updatedAt,
    fetchedAt,
    contentHash: issueBodyHash(body),
  };
}

function supportedRefs(refs: readonly IssueRef[]): IssueRef[] {
  const seen = new Set<string>();
  const supported: IssueRef[] = [];
  for (const candidate of refs) {
    const ref = parseIssueRef(candidate.url);
    if (ref === null || ref.number !== candidate.number || seen.has(ref.url)) continue;
    seen.add(ref.url);
    supported.push(ref);
  }
  return supported;
}

export async function refreshIssueSnapshots(
  refs: readonly IssueRef[],
  previous: IssueSnapshotFile,
  opts: RefreshIssueSnapshotsOptions,
): Promise<RefreshIssueSnapshotsResult> {
  const snapshots = clonePrevious(previous);
  const refreshed: string[] = [];
  const failures: RefreshFailure[] = [];

  for (const ref of supportedRefs(refs)) {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zip-tools",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    };
    let response: Response;
    try {
      response = await opts.fetchImpl(
        `https://api.github.com/repos/zcash/zips/issues/${ref.number}`,
        { headers, redirect: "error", signal: AbortSignal.timeout(15_000) },
      );
    } catch {
      failures.push({ url: ref.url, reason: "network-error" });
      continue;
    }

    if (!response.ok) {
      failures.push({ url: ref.url, reason: httpFailureReason(response.status) });
      continue;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      failures.push({ url: ref.url, reason: "invalid-json" });
      continue;
    }

    const candidate = candidateFromResponse(payload, ref, opts.now());
    if (candidate === null) {
      failures.push({ url: ref.url, reason: "invalid-response" });
      continue;
    }

    try {
      const validated = validateIssueSnapshotFile({
        version: 1,
        issues: { [ref.url]: candidate },
      });
      snapshots.issues[ref.url] = validated.issues[ref.url];
      refreshed.push(ref.url);
    } catch {
      failures.push({ url: ref.url, reason: "invalid-response" });
    }
  }

  return { snapshots, refreshed, failures };
}
