import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type WranglerConfig = {
  main: string;
  cache: { enabled: boolean };
  exports: Record<string, { type: string; cache: { enabled: boolean } }>;
  assets: { binding: string; run_worker_first: boolean };
  compatibility_flags: string[];
  d1_databases: { binding: string }[];
  kv_namespaces: { binding: string }[];
  ai: { binding: string };
  vars: { SUMMARY_MODEL: string };
  triggers: { crons: string[] };
};

function parseJsonc(text: string): WranglerConfig {
  const stripped = text.replace(/\/\/.*$/gm, "");
  return JSON.parse(stripped) as WranglerConfig;
}

const wranglerPath = join(dirname(fileURLToPath(import.meta.url)), "..", "wrangler.jsonc");

test("wrangler.jsonc binds DB, KV, AI, SUMMARY_MODEL, and hourly cron", () => {
  const wrangler = parseJsonc(readFileSync(wranglerPath, "utf8"));
  assert.equal(wrangler.d1_databases[0].binding, "DB");
  assert.equal(wrangler.kv_namespaces[0].binding, "KV");
  assert.equal(wrangler.ai.binding, "AI");
  assert.equal(wrangler.vars.SUMMARY_MODEL, "@cf/meta/llama-3.1-8b-instruct");
  assert.ok(wrangler.triggers.crons.includes("0 * * * *"));
});

test("wrangler cron entrypoint calls handleScheduledRollup", () => {
  const wrangler = parseJsonc(readFileSync(wranglerPath, "utf8"));
  assert.equal(wrangler.main, "./worker.ts");
  const worker = readFileSync(join(dirname(wranglerPath), "worker.ts"), "utf8");
  assert.match(worker, /handleScheduledRollup/);
  assert.match(worker, /async scheduled/);
});

test("legacy-host gateway runs before cached pages and static assets", () => {
  const wrangler = parseJsonc(readFileSync(wranglerPath, "utf8"));
  assert.equal(wrangler.cache.enabled, true);
  assert.equal(wrangler.exports.default.cache.enabled, false);
  assert.equal(wrangler.exports.CachedSite.cache.enabled, true);
  assert.equal(wrangler.assets.binding, "ASSETS");
  assert.equal(wrangler.assets.run_worker_first, true);
  assert.ok(wrangler.compatibility_flags.includes("enable_ctx_exports"));
});
