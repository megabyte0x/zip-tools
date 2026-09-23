import assert from "node:assert/strict";
import { test } from "node:test";
import { issueBodyHash } from "../src/issueSnapshots.ts";
import { refreshIssueSnapshots } from "../src/refreshIssues.ts";
import type { IssueRef, IssueSnapshot, IssueSnapshotFile } from "../src/types.ts";

const issueUrl = "https://github.com/zcash/zips/issues/1302";
const secondIssueUrl = "https://github.com/zcash/zips/issues/1303";
const fetchedAt = "2026-09-23T00:00:00Z";

function issueRef(url = issueUrl, number = 1302): IssueRef {
  return { url, number };
}

function apiUrl(number: number): string {
  return `https://api.github.com/repos/zcash/zips/issues/${number}`;
}

function responseIssue(
  url = issueUrl,
  number = 1302,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    html_url: url,
    number,
    title: "Fixture issue",
    body: "## Motivation\n\nSynthetic description.",
    updated_at: "2026-07-05T21:00:43Z",
    ...overrides,
  };
}

function savedIssue(
  url = issueUrl,
  number = 1302,
  body = "## Prior\n\nLast-known-good body.",
): IssueSnapshot {
  return {
    url,
    number,
    title: "Prior issue",
    body,
    updatedAt: "2026-07-04T20:00:42Z",
    fetchedAt: "2026-09-22T00:00:00Z",
    contentHash: issueBodyHash(body),
  };
}

function previousWith(entry = savedIssue()): IssueSnapshotFile {
  return { version: 1, issues: { [entry.url]: entry } };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeFetch(
  reply: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) =>
    reply(input, init)) as typeof fetch;
}

// Catches an implementation that issues duplicate, redirected, unauthenticated, or broader-than-issue requests.
test("refresh gets only an opening issue description and deduplicates URLs", async () => {
  const requests: string[] = [];
  const fetchImpl = fakeFetch((input, init) => {
    requests.push(String(input));
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Accept"), "application/vnd.github+json");
    assert.equal(headers.get("X-GitHub-Api-Version"), "2022-11-28");
    assert.equal(headers.get("User-Agent"), "zip-tools");
    assert.equal(headers.get("Authorization"), null);
    return jsonResponse(responseIssue());
  });

  const result = await refreshIssueSnapshots(
    [issueRef(), issueRef()],
    { version: 1, issues: {} },
    { fetchImpl, now: () => fetchedAt },
  );

  assert.deepEqual(requests, [apiUrl(1302)]);
  assert.deepEqual(result.refreshed, [issueUrl]);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.snapshots.issues[issueUrl], {
    url: issueUrl,
    number: 1302,
    title: "Fixture issue",
    body: "## Motivation\n\nSynthetic description.",
    updatedAt: "2026-07-05T21:00:43Z",
    fetchedAt,
    contentHash: issueBodyHash("## Motivation\n\nSynthetic description."),
  });
});

// Catches omission of the approved optional bearer token at the precise request boundary.
test("refresh uses an optional token only as a bearer authorization header", async () => {
  const fetchImpl = fakeFetch((_input, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    return jsonResponse(responseIssue());
  });

  const result = await refreshIssueSnapshots(
    [issueRef()],
    { version: 1, issues: {} },
    { fetchImpl, now: () => fetchedAt, token: "test-token" },
  );

  assert.deepEqual(result.failures, []);
});

// Catches parallel requests, which would make rate limiting and partial progress harder to reason about.
test("refresh fetches supported issue refs sequentially", async () => {
  const started: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstResponse = new Promise<Response>((resolve) => {
    releaseFirst = () => resolve(jsonResponse(responseIssue()));
  });
  const fetchImpl = fakeFetch((input) => {
    started.push(String(input));
    if (String(input) === apiUrl(1302)) return firstResponse;
    return jsonResponse(responseIssue(secondIssueUrl, 1303));
  });

  const refreshing = refreshIssueSnapshots(
    [issueRef(), issueRef(secondIssueUrl, 1303)],
    { version: 1, issues: {} },
    { fetchImpl, now: () => fetchedAt },
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [apiUrl(1302)]);
  assert.ok(releaseFirst);
  releaseFirst();

  const result = await refreshing;
  assert.deepEqual(started, [apiUrl(1302), apiUrl(1303)]);
  assert.deepEqual(result.refreshed, [issueUrl, secondIssueUrl]);
});

// Catches malformed or unsupported links reaching a network boundary rather than being ignored locally.
test("unsupported refs never reach fetch", async () => {
  let fetches = 0;
  const result = await refreshIssueSnapshots(
    [
      { url: "https://github.com/zcash/zips/issues/1302?comment=1", number: 1302 },
      { url: issueUrl, number: 1303 },
      { url: "https://github.com/zcash/zips/pull/1302", number: 1302 },
    ] as IssueRef[],
    { version: 1, issues: {} },
    {
      fetchImpl: fakeFetch(() => {
        fetches += 1;
        return jsonResponse(responseIssue());
      }),
      now: () => fetchedAt,
    },
  );

  assert.equal(fetches, 0);
  assert.deepEqual(result.refreshed, []);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.snapshots, { version: 1, issues: {} });
});

// Catches a failed refresh corrupting or deleting the last-known-good entry, including its evidence fields.
test("failed candidates preserve an existing last-known-good entry", async () => {
  const existing = savedIssue();
  const previous = previousWith(existing);
  const before = structuredClone(previous);
  const cases: Array<{
    name: string;
    reply: () => Response | Promise<Response>;
    reason: string;
  }> = [
    { name: "403", reply: () => jsonResponse({ message: "forbidden" }, 403), reason: "forbidden" },
    { name: "404", reply: () => jsonResponse({ message: "not found" }, 404), reason: "not-found" },
    { name: "429", reply: () => jsonResponse({ message: "slow down" }, 429), reason: "rate-limited" },
    { name: "500", reply: () => jsonResponse({ message: "server error" }, 500), reason: "server-error" },
    {
      name: "rejected fetch",
      reply: () => Promise.reject(new Error("transport details must not escape")),
      reason: "network-error",
    },
    {
      name: "invalid JSON",
      reply: () => new Response("{ not JSON", { status: 200 }),
      reason: "invalid-json",
    },
    {
      name: "empty body",
      reply: () => jsonResponse(responseIssue(issueUrl, 1302, { body: "" })),
      reason: "invalid-response",
    },
    {
      name: "null body",
      reply: () => jsonResponse(responseIssue(issueUrl, 1302, { body: null })),
      reason: "invalid-response",
    },
    {
      name: "wrong number",
      reply: () => jsonResponse(responseIssue(issueUrl, 1303)),
      reason: "invalid-response",
    },
    {
      name: "wrong URL",
      reply: () => jsonResponse(responseIssue(secondIssueUrl)),
      reason: "invalid-response",
    },
    {
      name: "missing updated_at",
      reply: () => {
        const value = responseIssue();
        delete value.updated_at;
        return jsonResponse(value);
      },
      reason: "invalid-response",
    },
    {
      name: "pull request",
      reply: () => jsonResponse(responseIssue(issueUrl, 1302, { pull_request: {} })),
      reason: "invalid-response",
    },
  ];

  for (const failure of cases) {
    const result = await refreshIssueSnapshots(
      [issueRef()],
      previous,
      { fetchImpl: fakeFetch(failure.reply), now: () => fetchedAt },
    );
    assert.deepEqual(result.refreshed, [], failure.name);
    assert.deepEqual(result.failures, [{ url: issueUrl, reason: failure.reason }], failure.name);
    assert.deepEqual(result.snapshots.issues[issueUrl], existing, failure.name);
    assert.deepEqual(previous, before, `${failure.name} must not mutate input`);
  }
});

// Catches partial refreshes rolling back a success merely because a later independently requested issue fails.
test("refresh retains successes and reports failures in one pass", async () => {
  const previous = { version: 1 as const, issues: {} };
  const result = await refreshIssueSnapshots(
    [issueRef(), issueRef(secondIssueUrl, 1303)],
    previous,
    {
      fetchImpl: fakeFetch((input) =>
        String(input) === apiUrl(1302)
          ? jsonResponse(responseIssue())
          : jsonResponse({ message: "not found" }, 404),
      ),
      now: () => fetchedAt,
    },
  );

  assert.deepEqual(result.refreshed, [issueUrl]);
  assert.deepEqual(result.failures, [{ url: secondIssueUrl, reason: "not-found" }]);
  assert.deepEqual(Object.keys(result.snapshots.issues), [issueUrl]);
  assert.equal(
    result.snapshots.issues[issueUrl].contentHash,
    issueBodyHash("## Motivation\n\nSynthetic description."),
  );
  assert.deepEqual(previous, { version: 1, issues: {} });
});

// Catches a failed first capture leaving a fabricated empty or invalid cache entry behind.
test("failed first capture leaves no snapshot entry", async () => {
  const result = await refreshIssueSnapshots(
    [issueRef()],
    { version: 1, issues: {} },
    {
      fetchImpl: fakeFetch(() => jsonResponse({ message: "forbidden" }, 403)),
      now: () => fetchedAt,
    },
  );

  assert.equal(Object.hasOwn(result.snapshots.issues, issueUrl), false);
  assert.deepEqual(result.failures, [{ url: issueUrl, reason: "forbidden" }]);
});
