import { handleTrendingGet, type ViewsEnv } from "../../../lib/views";
import { cloudflareEnv } from "../../../lib/cloudflareEnv";

async function loadEnv(): Promise<ViewsEnv> {
  return cloudflareEnv<ViewsEnv>();
}

export async function GET(): Promise<Response> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  return handleTrendingGet(await loadEnv(), todayUtc);
}
