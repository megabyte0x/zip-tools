import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryCacheKey, buildSummaryPrompt, handleSummaryGet } from "./summary.ts";
import { summaryNeedsBodyCopy } from "./summaryCopy.ts";

test("summaryCacheKey joins sha and id", () => {
  assert.equal(summaryCacheKey("abc", "32"), "abc:32");
});

test("buildSummaryPrompt truncates body to 12000 and forbids invented status", () => {
  const prompt = buildSummaryPrompt("Title", "x".repeat(13000));
  assert.ok(prompt.includes("do not invent status or NU membership"));
  assert.ok(prompt.includes("120 words"));
  assert.ok(!prompt.includes("x".repeat(12001)));
});

function fakeKv() {
  const store = new Map<string, { value: string; expirationTtl?: number }>();
  return {
    store,
    async get(key: string): Promise<string | null> {
      return store.get(key)?.value ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      store.set(key, { value, expirationTtl: options?.expirationTtl });
    },
  };
}

test("handleSummaryGet returns 422 when body is null", async () => {
  let ran = 0;
  const res = await handleSummaryGet(
    "32",
    {
      KV: fakeKv(),
      AI: {
        async run() {
          ran += 1;
          return { response: "nope" };
        },
      },
    },
    async () => ({ title: "T", body: null, snapshotSha: "abc" }),
  );
  assert.equal(res.status, 422);
  assert.deepEqual(await res.json(), { error: "needs-body" });
  assert.equal(ran, 0);
});

test("handleSummaryGet KV hit skips AI", async () => {
  let ran = 0;
  const KV = fakeKv();
  await KV.put("abc:32", "cached summary");
  const res = await handleSummaryGet(
    "32",
    {
      KV,
      AI: {
        async run() {
          ran += 1;
          return { response: "fresh" };
        },
      },
    },
    async () => ({ title: "T", body: "hello", snapshotSha: "abc" }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "cached summary", generated: true, cached: true });
  assert.equal(ran, 0);
});

test("handleSummaryGet returns 503 when AI throws", async () => {
  const res = await handleSummaryGet(
    "32",
    {
      KV: fakeKv(),
      AI: {
        async run() {
          throw new Error("model down");
        },
      },
    },
    async () => ({ title: "T", body: "hello", snapshotSha: "abc" }),
  );
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "unavailable" });
});

test("handleSummaryGet returns 404 for unknown id", async () => {
  let ran = 0;
  const res = await handleSummaryGet(
    "999",
    {
      KV: fakeKv(),
      AI: {
        async run() {
          ran += 1;
          return { response: "nope" };
        },
      },
    },
    async () => null,
  );
  assert.equal(res.status, 404);
  assert.equal(ran, 0);
});

test("handleSummaryGet success caches for 30 days", async () => {
  const KV = fakeKv();
  const prompts: unknown[] = [];
  const res = await handleSummaryGet(
    "32",
    {
      KV,
      AI: {
        async run(_model: string, input: unknown) {
          prompts.push(input);
          return { response: "a summary" };
        },
      },
      SUMMARY_MODEL: "@cf/meta/llama-3.1-8b-instruct",
    },
    async () => ({ title: "T", body: "hello", snapshotSha: "abc" }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "a summary", generated: true, cached: false });
  assert.equal(KV.store.get("abc:32")?.value, "a summary");
  assert.equal(KV.store.get("abc:32")?.expirationTtl, 30 * 24 * 60 * 60);
  assert.equal(prompts.length, 1);
});

test("needs-body accordion copy omits official CTA", () => {
  const copy = summaryNeedsBodyCopy();
  assert.equal(copy, "A summary needs an in-app body.");
  assert.ok(!copy.includes("Open on zips.z.cash"));
  const src = readFileSync(new URL("../components/GeneratedSummary.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("summaryNeedsBodyCopy"));
  assert.ok(!src.includes("FALLBACK_CTA"));
  assert.ok(!src.includes("Open on zips.z.cash"));
});
