import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  handleScheduledRollup,
  handleTrendingGet,
  handleViewsPost,
  hashIp,
  rollupEvents,
  trendingFromDaily,
  viewDedupKey,
} from "./views.ts";

test("viewDedupKey format", () => {
  assert.equal(viewDedupKey("32", "abcd"), "view:32:abcd");
});

test("rollupEvents groups by zip and day", () => {
  const rows = rollupEvents([
    { zipId: "32", day: "2026-09-18" },
    { zipId: "32", day: "2026-09-18" },
    { zipId: "1", day: "2026-09-17" },
  ]);
  assert.deepEqual(
    rows.sort((a, b) => a.zip_id.localeCompare(b.zip_id)),
    [
      { zip_id: "1", day: "2026-09-17", count: 1 },
      { zip_id: "32", day: "2026-09-18", count: 2 },
    ],
  );
});

test("trendingFromDaily includes today-6 as a 7-day window", () => {
  const top = trendingFromDaily(
    [{ zip_id: "32", day: "2026-09-12", count: 9 }],
    "2026-09-18",
    12,
  );
  assert.deepEqual(top, [{ id: "32", count: 9 }]);
});

test("trendingFromDaily sums last 7 UTC days and caps at 12", () => {
  const top = trendingFromDaily(
    [
      { zip_id: "32", day: "2026-09-18", count: 3 },
      { zip_id: "32", day: "2026-09-11", count: 9 },
      { zip_id: "1", day: "2026-09-17", count: 4 },
    ],
    "2026-09-18",
    12,
  );
  assert.deepEqual(top, [
    { id: "1", count: 4 },
    { id: "32", count: 3 },
  ]);
});

test("hashIp is SHA-256 hex truncated to 16 chars", async () => {
  assert.equal(await hashIp("1.2.3.4"), "6694f83c9f476da3");
});

type DataPoint = { blobs?: string[]; doubles?: number[]; indexes?: (string | number)[] };

function fakeKv(nowMs: number) {
  const store = new Map<string, { value: string; expiresAtMs: number }>();
  return {
    store,
    async get(key: string): Promise<string | null> {
      const row = store.get(key);
      if (!row) return null;
      if (row.expiresAtMs <= nowMs) {
        store.delete(key);
        return null;
      }
      return row.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const ttl = options?.expirationTtl ?? 0;
      store.set(key, { value, expiresAtMs: nowMs + ttl * 1000 });
    },
  };
}

function fakeEnv(nowMs: number) {
  const writes: DataPoint[] = [];
  const KV = fakeKv(nowMs);
  const statements: { sql: string; args: unknown[] }[] = [];
  const daily = new Map<string, { zip_id: string; day: string; count: number }>();
  return {
    writes,
    statements,
    daily,
    env: {
      KV,
      VIEWS: {
        writeDataPoint(point: DataPoint) {
          writes.push(point);
        },
      },
      DB: {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async run() {
                  statements.push({ sql, args });
                  if (/INSERT INTO view_daily/i.test(sql)) {
                    const [zip_id, day, count] = args as [string, string, number];
                    const key = `${zip_id}|${day}`;
                    if (/count\s*=\s*(?:view_daily\.)?count\s*\+\s*excluded\.count/i.test(sql)) {
                      const existing = daily.get(key);
                      const add = typeof count === "number" ? count : 0;
                      daily.set(key, { zip_id, day, count: (existing?.count ?? 0) + add });
                    } else if (/count\s*=\s*(?:view_daily\.)?count\s*\+\s*1/i.test(sql)) {
                      const existing = daily.get(key);
                      daily.set(key, { zip_id, day, count: (existing?.count ?? 0) + 1 });
                    } else {
                      daily.set(key, { zip_id, day, count });
                    }
                  }
                  return { success: true };
                },
                async all() {
                  statements.push({ sql, args });
                  return { results: [...daily.values()] };
                },
              };
            },
            async all() {
              statements.push({ sql, args: [] });
              return { results: [...daily.values()] };
            },
          };
        },
      },
    },
  };
}

function viewsRequest(body: unknown, ip = "1.2.3.4") {
  return new Request("https://example.com/api/views", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "CF-Connecting-IP": ip,
    },
    body: JSON.stringify(body),
  });
}

test("handleViewsPost writes once then 204s within 1800s; missing id is 400", async () => {
  const nowMs = Date.parse("2026-09-18T12:00:00Z");
  const fake = fakeEnv(nowMs);

  const first = await handleViewsPost(viewsRequest({ id: "32" }), fake.env, nowMs);
  assert.equal(first.status, 204);
  assert.equal(fake.writes.length, 1);
  assert.deepEqual(fake.writes[0]?.blobs, ["32"]);
  assert.ok(!JSON.stringify(fake.writes).includes("1.2.3.4"));
  assert.equal(fake.env.KV.store.size, 1);
  const [key, row] = [...fake.env.KV.store.entries()][0]!;
  assert.equal(key, viewDedupKey("32", await hashIp("1.2.3.4")));
  assert.ok(!key.includes("1.2.3.4"));
  assert.ok(!row.value.includes("1.2.3.4"));
  assert.equal(row.expiresAtMs, nowMs + 1800 * 1000);

  const second = await handleViewsPost(viewsRequest({ id: "32" }), fake.env, nowMs + 1000);
  assert.equal(second.status, 204);
  assert.equal(fake.writes.length, 1);

  const missing = await handleViewsPost(viewsRequest({}), fake.env, nowMs);
  assert.equal(missing.status, 400);
});

test("handleViewsPost returns 204 when bindings are missing", async () => {
  const res = await handleViewsPost(viewsRequest({ id: "32" }), {}, Date.now());
  assert.equal(res.status, 204);
});

test("handleTrendingGet returns empty items when D1 has no rows", async () => {
  const fake = fakeEnv(0);
  const res = await handleTrendingGet(fake.env, "2026-09-18");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { items: [] });
});

test("handleViewsPost increments view_daily for today without storing raw IP", async () => {
  const nowMs = Date.parse("2026-09-18T12:00:00Z");
  const fake = fakeEnv(nowMs);

  const first = await handleViewsPost(viewsRequest({ id: "32" }), fake.env, nowMs);
  assert.equal(first.status, 204);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 1);

  const otherIp = await handleViewsPost(viewsRequest({ id: "32" }, "9.9.9.9"), fake.env, nowMs);
  assert.equal(otherIp.status, 204);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 2);

  const dumped = JSON.stringify({ statements: fake.statements, daily: [...fake.daily.values()] });
  assert.ok(!dumped.includes("1.2.3.4"));
  assert.ok(!dumped.includes("9.9.9.9"));
});

test("handleViewsPost increments daily count when Analytics Engine is absent", async () => {
  const nowMs = Date.parse("2026-09-18T12:00:00Z");
  const fake = fakeEnv(nowMs);
  const env = { KV: fake.env.KV, DB: fake.env.DB };
  const res = await handleViewsPost(viewsRequest({ id: "32" }), env, nowMs);
  assert.equal(res.status, 204);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 1);
  assert.equal(fake.writes.length, 0);
});

test("handleViewsPost does not store an id that is not in the corpus", async () => {
  const nowMs = Date.parse("2026-09-18T12:00:00Z");
  const fake = fakeEnv(nowMs);
  const unknown = await handleViewsPost(viewsRequest({ id: "not-a-zip" }), fake.env, nowMs);
  assert.equal(unknown.status, 400);
  assert.equal(fake.writes.length, 0);
  assert.equal(fake.daily.size, 0);
  assert.equal(fake.statements.length, 0);

  const known = await handleViewsPost(viewsRequest({ id: "32" }), fake.env, nowMs);
  assert.equal(known.status, 204);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 1);

  const repeat = await handleViewsPost(viewsRequest({ id: "32" }), fake.env, nowMs + 1000);
  assert.equal(repeat.status, 204);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 1);
});

function sqliteViewsDb() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE view_daily (
      zip_id TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (zip_id, day)
    )
  `);
  const DB = {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              statement.run(...(args as Array<string | number | null>));
              return { success: true };
            },
            async all() {
              return { results: statement.all(...(args as Array<string | number>)) as unknown as import("./views").ViewDailyRow[] };
            },
          };
        },
        async all() {
          return { results: statement.all() as unknown as import("./views").ViewDailyRow[] };
        },
      };
    },
  };
  return { database, DB };
}

test("handleViewsPost records a known id through sqlite, which rejects an extra bind", async () => {
  const nowMs = Date.parse("2026-09-18T12:00:00Z");
  const { database, DB } = sqliteViewsDb();
  const env = { KV: fakeKv(nowMs), DB };
  const countOf = (id: string, day: string) => {
    const row = database
      .prepare("SELECT count FROM view_daily WHERE zip_id = ? AND day = ?")
      .get(id, day) as { count: number } | undefined;
    return row?.count ?? 0;
  };
  assert.throws(
    () => database.prepare(
      "INSERT INTO view_daily (zip_id, day, count) VALUES (?, ?, 1)",
    ).run("32", "2026-09-18", 1),
    /column index out of range/,
  );

  try {
    const unknown = await handleViewsPost(viewsRequest({ id: "not-a-zip" }), env, nowMs);
    assert.equal(unknown.status, 400);
    assert.equal(countOf("not-a-zip", "2026-09-18"), 0);

    const known = await handleViewsPost(viewsRequest({ id: "32" }), env, nowMs);
    assert.equal(known.status, 204);
    assert.equal(countOf("32", "2026-09-18"), 1);

    const repeat = await handleViewsPost(viewsRequest({ id: "32" }), env, nowMs + 1000);
    assert.equal(repeat.status, 204);
    assert.equal(countOf("32", "2026-09-18"), 1);
  } finally {
    database.close();
  }
});

test("handleScheduledRollup adds to a stored daily count and ignores an empty batch", async () => {
  const fake = fakeEnv(0);
  fake.daily.set("32|2026-09-18", { zip_id: "32", day: "2026-09-18", count: 5 });
  await handleScheduledRollup(fake.env, []);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 5);

  await handleScheduledRollup(fake.env, [
    { zipId: "32", day: "2026-09-18" },
    { zipId: "32", day: "2026-09-18" },
  ]);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 7);
});

test("handleScheduledRollup upserts grouped counts into D1", async () => {
  const fake = fakeEnv(0);
  await handleScheduledRollup(fake.env, [
    { zipId: "32", day: "2026-09-18" },
    { zipId: "32", day: "2026-09-18" },
    { zipId: "1", day: "2026-09-17" },
  ]);
  assert.equal(fake.daily.get("32|2026-09-18")?.count, 2);
  assert.equal(fake.daily.get("1|2026-09-17")?.count, 1);
  assert.ok(fake.statements.some((s) => /INSERT INTO view_daily/i.test(s.sql)));
});
