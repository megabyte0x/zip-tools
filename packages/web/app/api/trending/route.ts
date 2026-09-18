import { handleTrendingGet, type ViewsEnv } from "../../../lib/views";

async function loadEnv(): Promise<ViewsEnv> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx.env ?? {}) as ViewsEnv;
  } catch {
    return {};
  }
}

export async function GET(): Promise<Response> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  return handleTrendingGet(await loadEnv(), todayUtc);
}
