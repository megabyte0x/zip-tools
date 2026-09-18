import { handleViewsPost, type ViewsEnv } from "../../../lib/views";

async function loadEnv(): Promise<ViewsEnv> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx.env ?? {}) as ViewsEnv;
  } catch {
    return {};
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleViewsPost(request, await loadEnv(), Date.now());
}
