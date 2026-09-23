import assert from "node:assert/strict";
import { test } from "node:test";
import { cloudflareEnv } from "./cloudflareEnv.ts";

test("cloudflareEnv returns empty bindings only for plain Node next start without Cloudflare context", async () => {
  let calls = 0;
  const bindings = await cloudflareEnv<{ VIEWS: string }>(
    async () => {
      calls += 1;
      return { env: { VIEWS: "unexpected" } };
    },
    { NODE_ENV: "production", NEXT_RUNTIME: "nodejs" },
    {},
  );

  assert.deepEqual(bindings, {});
  assert.equal(calls, 0);
});

test("cloudflareEnv preserves deployed Cloudflare bindings when its context symbol exists", async () => {
  const context = { [Symbol.for("__cloudflare-context__")]: {} };
  const bindings = { VIEWS: "deployed" };
  let calls = 0;
  const result = await cloudflareEnv<typeof bindings>(
    async () => {
      calls += 1;
      return { env: bindings };
    },
    { NODE_ENV: "production", NEXT_RUNTIME: "nodejs" },
    context,
  );

  assert.deepEqual(result, bindings);
  assert.equal(calls, 1);
});

test("cloudflareEnv degrades to empty bindings when a non-bypass context loader rejects", async () => {
  let calls = 0;
  const bindings = await cloudflareEnv<{ VIEWS: string }>(
    async () => {
      calls += 1;
      throw new Error("injected-context-failure");
    },
    { NODE_ENV: "development", NEXT_RUNTIME: "nodejs" },
    {},
  );

  assert.deepEqual(bindings, {});
  assert.equal(calls, 1);
});

test("cloudflareEnv still loads bindings outside plain Node next start", async () => {
  let calls = 0;
  const bindings = await cloudflareEnv<{ VIEWS: string }>(
    async () => {
      calls += 1;
      return { env: { VIEWS: "development" } };
    },
    { NODE_ENV: "development", NEXT_RUNTIME: "nodejs" },
    {},
  );

  assert.deepEqual(bindings, { VIEWS: "development" });
  assert.equal(calls, 1);
});
