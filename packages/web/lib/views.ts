export type ViewEvent = { zipId: string; day: string };

export type ViewDailyRow = { zip_id: string; day: string; count: number };

export type TrendingItem = { id: string; count: number };

export type ViewsEnv = {
  KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
  VIEWS?: {
    writeDataPoint(point: {
      blobs?: string[];
      doubles?: number[];
      indexes?: (string | number)[];
    }): void;
  };
  DB?: {
    prepare(sql: string): {
      bind(...args: unknown[]): {
        run(): Promise<unknown>;
        all(): Promise<{ results?: ViewDailyRow[] }>;
      };
      all(): Promise<{ results?: ViewDailyRow[] }>;
    };
  };
};

const DEDUP_TTL_SECONDS = 1800;

export function viewDedupKey(id: string, ipHash: string): string {
  return `view:${id}:${ipHash}`;
}

export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 16);
}

export function rollupEvents(events: ViewEvent[]): ViewDailyRow[] {
  const counts = new Map<string, ViewDailyRow>();
  for (const event of events) {
    const key = `${event.zipId}|${event.day}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { zip_id: event.zipId, day: event.day, count: 1 });
    }
  }
  return [...counts.values()];
}

function addUtcDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}

export function trendingFromDaily(
  rows: ViewDailyRow[],
  todayUtc: string,
  limit = 12,
): TrendingItem[] {
  const oldest = addUtcDays(todayUtc, -6);
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.day < oldest || row.day > todayUtc) continue;
    totals.set(row.zip_id, (totals.get(row.zip_id) ?? 0) + row.count);
  }
  return [...totals.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);
}

function jsonResponse(status: number, body?: unknown): Response {
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("id" in body)) return null;
  const id = (body as { id: unknown }).id;
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

export async function handleViewsPost(
  request: Request,
  env: ViewsEnv,
  _nowMs: number,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400);
  }
  const id = requestId(body);
  if (id === null) return jsonResponse(400);
  if (!env.KV || !env.VIEWS) return jsonResponse(204);

  const ipHash = await hashIp(clientIp(request));
  const key = viewDedupKey(id, ipHash);
  const existing = await env.KV.get(key);
  if (existing !== null) return jsonResponse(204);

  try {
    env.VIEWS.writeDataPoint({ blobs: [id], indexes: ["1"] });
    await env.KV.put(key, "1", { expirationTtl: DEDUP_TTL_SECONDS });
  } catch {
    return jsonResponse(204);
  }
  return jsonResponse(204);
}

export async function handleTrendingGet(env: ViewsEnv, todayUtc: string): Promise<Response> {
  if (!env.DB) return jsonResponse(200, { items: [] });
  try {
    const result = await env.DB.prepare("SELECT zip_id, day, count FROM view_daily").all();
    const rows = result.results ?? [];
    return jsonResponse(200, { items: trendingFromDaily(rows, todayUtc) });
  } catch {
    return jsonResponse(200, { items: [] });
  }
}

export async function handleScheduledRollup(env: ViewsEnv, events: ViewEvent[]): Promise<void> {
  if (!env.DB) return;
  const rows = rollupEvents(events);
  for (const row of rows) {
    await env.DB.prepare(
      "INSERT INTO view_daily (zip_id, day, count) VALUES (?, ?, ?) ON CONFLICT(zip_id, day) DO UPDATE SET count = excluded.count",
    )
      .bind(row.zip_id, row.day, row.count)
      .run();
  }
}
