export type SummaryZip = {
  title: string;
  body: string | null;
  snapshotSha: string;
};

export type SummaryEnv = {
  KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
  AI?: {
    run(model: string, input: unknown): Promise<{ response?: string } | string>;
  };
  SUMMARY_MODEL?: string;
};

export type LoadZip = (id: string) => Promise<SummaryZip | null>;

const BODY_LIMIT = 12_000;
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function summaryCacheKey(snapshotSha: string, id: string): string {
  return `${snapshotSha}:${id}`;
}

export function buildSummaryPrompt(title: string, body: string): string {
  const truncated = body.slice(0, BODY_LIMIT);
  return [
    "Summarize this ZIP for a protocol reader in ≤ 120 words; do not invent status or NU membership.",
    `Title: ${title}`,
    truncated,
  ].join("\n\n");
}

function jsonResponse(status: number, body?: unknown): Response {
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function modelText(result: { response?: string } | string): string | null {
  if (typeof result === "string") {
    const text = result.trim();
    return text.length > 0 ? text : null;
  }
  if (typeof result?.response === "string") {
    const text = result.response.trim();
    return text.length > 0 ? text : null;
  }
  return null;
}

export async function handleSummaryGet(
  id: string,
  env: SummaryEnv,
  loadZip: LoadZip,
): Promise<Response> {
  const zip = await loadZip(id);
  if (!zip) return jsonResponse(404);
  if (zip.body == null) return jsonResponse(422, { error: "needs-body" });

  const key = summaryCacheKey(zip.snapshotSha, id);
  try {
    const cached = env.KV ? await env.KV.get(key) : null;
    if (cached !== null) {
      return jsonResponse(200, { text: cached, generated: true, cached: true });
    }
  } catch {
    return jsonResponse(503, { error: "unavailable" });
  }

  if (!env.AI) return jsonResponse(503, { error: "unavailable" });

  const model = env.SUMMARY_MODEL ?? DEFAULT_MODEL;
  const prompt = buildSummaryPrompt(zip.title, zip.body);
  let text: string | null;
  try {
    const result = await env.AI.run(model, { prompt });
    text = modelText(result);
  } catch {
    return jsonResponse(503, { error: "unavailable" });
  }
  if (text === null) return jsonResponse(503, { error: "unavailable" });

  try {
    await env.KV?.put(key, text, { expirationTtl: CACHE_TTL_SECONDS });
  } catch {
    // Still return the generated text; body rendering does not depend on cache.
  }

  return jsonResponse(200, { text, generated: true, cached: false });
}
